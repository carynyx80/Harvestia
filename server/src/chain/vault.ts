// Game Vault service: reads the vault on-chain, quotes $HRV prices for shop items,
// settles purchases the player signed (EIP-712) through the settler wallet, relays
// reward claims signed by the reward signer, and indexes vault events.
//
// Items are granted only after the purchase is confirmed on-chain, so a player can
// never receive an item without paying, or pay twice for one quote.
import { randomBytes } from 'node:crypto';
import {
  createPublicClient, createWalletClient, defineChain, formatUnits, getAddress, http, isAddress, parseEventLogs, parseUnits,
  type Address, type Hex, type PublicClient, type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { CATALOG_BY_ID } from '../../../shared/catalog';
import { REWARD_TYPES, VAULT_ABI, vaultDomain, type VaultInfo } from '../../../shared/vault';
import type { ChainRepo, PurchaseRow, VaultEventRow } from '../store/types';

export interface VaultConfig {
  chainId: number;
  rpc: string;
  vault: Address;
  token: Address;
  testToken: boolean;
  startBlock: bigint;
  settlerKey?: Hex;
  rewardSignerKey?: Hex;
  /** fixed reference price, allowed only on test networks */
  testUsdPerHrv?: number;
  /** HRV accrued per delivered contract, and the most one wallet can earn per day */
  rewardPerContract: number;
  rewardDailyCap: number;
}

export const QUOTE_SECONDS = 120;
const MAINNET_ID = 4663;

export class VaultError extends Error { constructor(public status: number, message: string) { super(message); } }

export class VaultService {
  readonly enabled: boolean;
  readonly reason?: string;
  private client?: PublicClient;
  private settler?: { account: PrivateKeyAccount; wallet: WalletClient };
  private rewardSigner?: PrivateKeyAccount;
  private statsCache?: { at: number; stats: NonNullable<VaultInfo['stats']> };

  constructor(readonly cfg: VaultConfig | null, private repo: ChainRepo, private log: (msg: string, extra?: unknown) => void = () => {}) {
    if (!cfg) { this.enabled = false; this.reason = 'The Game Vault is not deployed yet'; return; }
    if (cfg.chainId === MAINNET_ID) { this.enabled = false; this.reason = 'The Game Vault opens on mainnet only after an independent audit'; return; }
    if (!cfg.settlerKey || !cfg.rewardSignerKey) { this.enabled = false; this.reason = 'The vault service keys are not configured'; return; }
    if (!cfg.testUsdPerHrv) { this.enabled = false; this.reason = 'No verified $HRV price source is configured'; return; }
    this.enabled = true;
    const chain = defineChain({ id: cfg.chainId, name: `chain-${cfg.chainId}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] } } });
    this.client = createPublicClient({ chain, transport: http(cfg.rpc, { timeout: 15_000 }) }) as PublicClient;
    const account = privateKeyToAccount(cfg.settlerKey);
    this.settler = { account, wallet: createWalletClient({ account, chain, transport: http(cfg.rpc, { timeout: 15_000 }) }) };
    this.rewardSigner = privateKeyToAccount(cfg.rewardSignerKey);
  }

  private need() { if (!this.enabled) throw new VaultError(503, this.reason ?? 'The Game Vault is unavailable'); return this.cfg!; }

  price() {
    const cfg = this.need();
    return { usdPerHrv: cfg.testUsdPerHrv!, source: 'Fixed test price (test network only — no real value)', verified: false, at: Date.now() };
  }

  async info(): Promise<VaultInfo> {
    if (!this.enabled) return { enabled: false, reason: this.reason };
    const cfg = this.cfg!;
    return { enabled: true, chainId: cfg.chainId, vault: cfg.vault, token: cfg.token, testToken: cfg.testToken, price: this.price(), stats: await this.stats() };
  }

  async stats() {
    if (this.statsCache && Date.now() - this.statsCache.at < 10_000) return this.statsCache.stats;
    const cfg = this.need(), c = this.client!;
    const read = (functionName: 'totalBurned' | 'rewardReserve' | 'totalPlayerBalances' | 'operationsBalance' | 'totalRewardsPaid' | 'dailyRewardCap') =>
      c.readContract({ address: cfg.vault, abi: VAULT_ABI, functionName }) as Promise<bigint>;
    const [burned, reserve, players, ops, paid, cap, solvent, paused] = await Promise.all([
      read('totalBurned'), read('rewardReserve'), read('totalPlayerBalances'), read('operationsBalance'), read('totalRewardsPaid'), read('dailyRewardCap'),
      c.readContract({ address: cfg.vault, abi: VAULT_ABI, functionName: 'solvent' }) as Promise<boolean>,
      c.readContract({ address: cfg.vault, abi: VAULT_ABI, functionName: 'paused' }) as Promise<boolean>,
    ]);
    const stats = { totalBurned: burned.toString(), rewardReserve: reserve.toString(), playerBalances: players.toString(), operations: ops.toString(), rewardsPaid: paid.toString(), dailyRewardCap: cap.toString(), solvent, paused };
    this.statsCache = { at: Date.now(), stats };
    return stats;
  }

  async balance(wallet: Address) {
    const cfg = this.need();
    return this.client!.readContract({ address: cfg.vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [wallet] }) as Promise<bigint>;
  }

  /** Prices a shop item in $HRV and records a quote the player can sign within QUOTE_SECONDS. */
  async quote(playerId: string, wallet: Address, item: string, qty: number, now = Date.now()) {
    const cfg = this.need(), it = CATALOG_BY_ID[item];
    if (!it) throw new VaultError(400, 'Unknown item');
    const p = this.price(), usd = it.usd * qty;
    const amount = parseUnits((usd / p.usdPerHrv).toFixed(6), 18);
    const row: PurchaseRow = {
      id: `0x${randomBytes(32).toString('hex')}`, playerId, wallet, item, qty, amountWei: amount.toString(), usd, usdPerHrv: p.usdPerHrv, priceSource: p.source,
      deadline: new Date(now + QUOTE_SECONDS * 1000), status: 'quoted', txHash: null, error: null, createdAt: new Date(now), settledAt: null,
    };
    await this.repo.createPurchase(row);
    return { ...row, domain: vaultDomain(cfg.chainId, cfg.vault), deadlineSeconds: Math.floor(+row.deadline / 1000) };
  }

  /**
   * Submits a signed purchase on-chain. Moves the quote quoted → submitted atomically (so one
   * quote can't be sent twice), sends vault.spend from the settler, and waits for the receipt.
   */
  async settle(purchase: PurchaseRow, signature: Hex, now = Date.now()) {
    const cfg = this.need();
    if (purchase.status !== 'quoted') throw new VaultError(409, 'This purchase was already submitted');
    if (+purchase.deadline <= now) throw new VaultError(400, 'This quote has expired — get a new price');
    const bal = await this.balance(purchase.wallet as Address);
    if (bal < BigInt(purchase.amountWei)) throw new VaultError(400, `Your Game Vault holds ${formatUnits(bal, 18)} HRV — deposit more first`);
    if (!(await this.repo.movePurchase(purchase.id, 'quoted', { status: 'submitted' }))) throw new VaultError(409, 'This purchase was already submitted');
    try {
      const args = [purchase.wallet as Address, BigInt(purchase.amountWei), purchase.id as Hex, BigInt(Math.floor(+purchase.deadline / 1000)), signature] as const;
      // simulate first: a bad signature or low balance fails here without spending gas
      const { request } = await this.client!.simulateContract({ address: cfg.vault, abi: VAULT_ABI, functionName: 'spend', args, account: this.settler!.account });
      const hash = await this.settler!.wallet.writeContract(request);
      const receipt = await this.client!.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== 'success') throw new Error('The purchase transaction reverted');
      await this.repo.movePurchase(purchase.id, 'submitted', { status: 'settled', txHash: hash, settledAt: new Date() });
      this.statsCache = undefined;
      return hash;
    } catch (e) {
      const msg = shortError(e);
      await this.repo.movePurchase(purchase.id, 'submitted', { status: 'failed', error: msg });
      throw new VaultError(400, msg);
    }
  }

  /** Records $HRV earned for a delivered contract, within the wallet's daily cap. Returns the amount (0 if capped). */
  async accrueContractReward(wallet: string, playerId: string, now = Date.now()) {
    if (!this.enabled) return 0;
    const cfg = this.cfg!, per = parseUnits(String(cfg.rewardPerContract), 18), cap = parseUnits(String(cfg.rewardDailyCap), 18);
    const today = await this.repo.rewardTotal(wallet, new Date(now - (now % 86_400_000)));
    const amount = today + per > cap ? cap - today : per;
    if (amount <= 0n) return 0;
    await this.repo.addReward(wallet, playerId, amount, 'delivery contract');
    return Number(formatUnits(amount, 18));
  }

  async rewards(wallet: Address) {
    const cfg = this.need();
    const earned = await this.repo.rewardTotal(wallet);
    const claimed = await this.client!.readContract({ address: cfg.vault, abi: VAULT_ABI, functionName: 'rewardsClaimed', args: [wallet] }) as bigint;
    return { earned, claimed, claimable: earned > claimed ? earned - claimed : 0n };
  }

  /** Signs the player's cumulative earnings and relays the claim; the vault pays only the unclaimed part. */
  async claim(wallet: Address) {
    const cfg = this.need();
    const { earned, claimable } = await this.rewards(wallet);
    if (claimable <= 0n) throw new VaultError(400, 'Nothing to claim yet');
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const signature = await this.rewardSigner!.signTypedData({ domain: vaultDomain(cfg.chainId, cfg.vault), types: REWARD_TYPES, primaryType: 'Reward', message: { player: wallet, totalEarned: earned, deadline } });
    try {
      const { request } = await this.client!.simulateContract({ address: cfg.vault, abi: VAULT_ABI, functionName: 'claimRewards', args: [wallet, earned, deadline, signature], account: this.settler!.account });
      const hash = await this.settler!.wallet.writeContract(request);
      const receipt = await this.client!.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== 'success') throw new Error('The claim transaction reverted');
      this.statsCache = undefined;
      return { hash, amount: formatUnits(claimable, 18) };
    } catch (e) { throw new VaultError(400, shortError(e)); }
  }

  /** Pulls new vault events from the chain into the database. Returns how many were added. */
  async index() {
    if (!this.enabled) return 0;
    const cfg = this.cfg!, c = this.client!;
    const latest = await c.getBlockNumber();
    let from = ((await this.repo.cursor('vault')) ?? cfg.startBlock - 1n) + 1n;
    let added = 0;
    while (from <= latest) {
      const to = from + 1999n < latest ? from + 1999n : latest;
      const logs = await c.getLogs({ address: cfg.vault, fromBlock: from, toBlock: to });
      const parsed = parseEventLogs({ abi: VAULT_ABI, logs });
      const times = new Map<bigint, Date>();
      const rows: VaultEventRow[] = [];
      for (const l of parsed) {
        if (!times.has(l.blockNumber)) times.set(l.blockNumber, new Date(Number((await c.getBlock({ blockNumber: l.blockNumber })).timestamp) * 1000));
        const a = l.args as Record<string, unknown>;
        const player = typeof a.player === 'string' ? getAddress(a.player) : typeof a.from === 'string' ? getAddress(a.from) : null;
        const amount = String(a.amount ?? a.received ?? 0n);
        const extra = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, String(v)]));
        rows.push({ chainId: cfg.chainId, txHash: l.transactionHash, logIndex: l.logIndex, block: l.blockNumber, at: times.get(l.blockNumber)!, kind: l.eventName, player, amount, extra });
      }
      added += await this.repo.saveEvents(rows);
      await this.repo.setCursor('vault', to);
      from = to + 1n;
    }
    if (added) this.statsCache = undefined;
    return added;
  }
}

const shortError = (e: unknown) => {
  const m = (e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Transaction failed';
  const reason = /Vault: [^"\n]+/.exec(m)?.[0];
  return (reason ?? m).slice(0, 200);
};

/** Reads vault settings from the environment; null when no vault is configured. */
export function vaultConfigFromEnv(env = process.env): VaultConfig | null {
  const vault = env.VAULT_ADDRESS, token = env.VAULT_TOKEN_ADDRESS;
  if (!vault || !token || !isAddress(vault) || !isAddress(token)) return null;
  return {
    chainId: Number(env.VAULT_CHAIN_ID ?? 46630),
    rpc: env.VAULT_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com',
    vault: getAddress(vault), token: getAddress(token),
    testToken: env.VAULT_TEST_TOKEN !== '0',
    startBlock: BigInt(env.VAULT_START_BLOCK ?? 0),
    settlerKey: env.SETTLER_PRIVATE_KEY as Hex | undefined,
    rewardSignerKey: env.REWARD_SIGNER_PRIVATE_KEY as Hex | undefined,
    testUsdPerHrv: env.HRV_TEST_USD_PRICE ? Number(env.HRV_TEST_USD_PRICE) : undefined,
    rewardPerContract: Number(env.REWARD_HRV_PER_CONTRACT ?? 5),
    rewardDailyCap: Number(env.REWARD_HRV_DAILY_CAP ?? 50),
  };
}
