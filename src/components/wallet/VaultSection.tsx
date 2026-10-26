'use client';
// Game Vault: on-chain balance, deposits and withdrawals (fees shown first), reward
// claims, and the public treasury: total burned, reward reserve and history.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { erc20Abi, formatUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { claimHrvRewards, getVault, getVaultHistory, getVaultMe } from '@/lib/api';
import { currentToken } from '@/lib/sync';
import { queryClient } from '@/lib/queryClient';
import { chainName, explorerTx, shortAddress, testFaucet, vaultDeposit, vaultWithdraw } from '@/lib/wallet';
import { VAULT_FEES_BPS, type VaultInfo } from '../../../shared/vault';
import { ITEM } from '@/game/data/items';
import { useGame } from '@/store/game';
import { Card } from '@/components/ui/kit';
import { Icon } from '@/components/hud/Icon';

const fmt = (wei: string | bigint | undefined, d = 2) => wei === undefined ? '—' : Number(formatUnits(BigInt(wei), 18)).toLocaleString('en-US', { maximumFractionDigits: d });
const reason = (e: unknown) => {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? 'Something went wrong';
  return /reject|denied|cancel/i.test(m) ? 'Cancelled in the wallet' : m.length > 160 ? `${m.slice(0, 160)}…` : m;
};
const refresh = () => queryClient.invalidateQueries({ queryKey: ['vault'] });

export function useVault() {
  const info = useQuery({ queryKey: ['vault', 'info'], queryFn: getVault, refetchInterval: 30_000 });
  const session = useGame(s => s.session);
  const me = useQuery({
    queryKey: ['vault', 'me', session?.wallet], queryFn: () => getVaultMe(currentToken()!),
    enabled: !!(info.data?.enabled && session?.wallet && currentToken()), refetchInterval: 30_000,
  });
  return { info: info.data, me: me.data, loading: info.isLoading };
}

function TxLink({ chainId, hash }: { chainId: number; hash: string }) {
  const u = explorerTx(chainId, hash);
  return u ? <a className="underline" href={u} target="_blank" rel="noreferrer">{hash.slice(0, 10)}…</a> : <span>{hash.slice(0, 10)}…</span>;
}

function AmountForm({ label, max, feeBps, verb, onSubmit, busy }: { label: string; max: bigint | undefined; feeBps: number; verb: string; onSubmit: (amount: string) => void; busy: boolean }) {
  const [v, setV] = useState('');
  const n = Number(v) || 0, fee = n * feeBps / 10_000;
  const tooMuch = max !== undefined && n > Number(formatUnits(max, 18));
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-1">
        <input value={v} onChange={e => setV(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={label} aria-label={label} className="w-28 border-2 border-wood bg-parch-l px-1" />
        {max !== undefined && <button className="text-xs underline" onClick={() => setV(formatUnits(max, 18))}>max</button>}
        <button className="btn-gold ml-auto !py-0.5" disabled={busy || n <= 0 || tooMuch} onClick={() => onSubmit(v)}>{verb}</button>
      </div>
      {n > 0 && <span className="text-xs text-muted">Fee {feeBps / 100}%: {fee.toLocaleString('en-US', { maximumFractionDigits: 4 })} HRV · {verb === 'Deposit' ? 'credited' : 'you receive'} {(n - fee).toLocaleString('en-US', { maximumFractionDigits: 4 })} HRV{tooMuch ? ' · more than you have' : ''}</span>}
    </div>
  );
}

export function VaultSection() {
  const { info, me } = useVault();
  const toast = useGame(s => s.toast), session = useGame(s => s.session);
  const { address, chainId } = useAccount();
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const history = useQuery({ queryKey: ['vault', 'history'], queryFn: getVaultHistory, enabled: !!info?.enabled, refetchInterval: 60_000 });
  const tokenBal = useReadContract({
    address: info?.token, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined, chainId: info?.chainId as never,
    query: { enabled: !!(info?.enabled && address), refetchInterval: 15_000 },
  });

  if (!info) return <Card className="md:col-span-2 text-sm text-muted">Loading the Game Vault…</Card>;
  if (!info.enabled) return (
    <Card className="md:col-span-2 flex flex-col gap-1">
      <div className="flex items-center gap-2"><Icon name="vault" /><b className="text-lg">Game Vault</b><span className="ml-auto border-2 border-wood-d bg-parch-d px-1.5 text-[11px] font-bold">Not open yet</span></div>
      <p className="m-0 text-sm">{info.reason}. Deposits ({VAULT_FEES_BPS.deposit / 100}% fee), withdrawals ({VAULT_FEES_BPS.withdraw / 100}% fee) and $HRV purchases (50% burned, 50% to the farmer reward treasury) open here once it is live.</p>
    </Card>
  );

  const run = async (label: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(label); setErr('');
    try { await fn(); toast(done, 'good'); await refresh(); void tokenBal.refetch(); } catch (e) { setErr(reason(e)); } finally { setBusy(''); }
  };
  const linked = !!session?.wallet && session.wallet === address;
  const s = info.stats!;

  return (
    <>
      <Card className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2"><Icon name="vault" /><b className="text-lg">Game Vault</b>
          {info.testToken && <span className="ml-auto border-2 border-wood-d bg-gold px-1.5 text-[11px] font-bold">TEST NETWORK · tHRV has no value</span>}</div>
        <b className="text-3xl text-gold-d">{linked ? `${fmt(me?.balance)} HRV` : '— HRV'}</b>
        <span className="text-xs text-muted">On {chainName(info.chainId!)} · vault {shortAddress(info.vault!)}</span>
        {!linked ? <p className="m-0 text-sm">Connect and sign in with your wallet to deposit and spend.</p> : chainId !== info.chainId ? (
          <p className="m-0 text-sm">Your wallet is on another network — vault actions will ask to switch to {chainName(info.chainId!)}.</p>
        ) : null}
        {linked && <>
          <span className="text-sm">In your wallet: <b>{fmt(tokenBal.data)} {info.testToken ? 'tHRV' : 'HRV'}</b></span>
          <AmountForm label="Deposit amount" max={tokenBal.data} feeBps={VAULT_FEES_BPS.deposit} verb="Deposit" busy={!!busy}
            onSubmit={a => run('deposit', () => vaultDeposit(info, a, setBusy), `Deposited ${a} HRV into the Game Vault`)} />
          <AmountForm label="Withdraw amount" max={me ? BigInt(me.balance) : undefined} feeBps={VAULT_FEES_BPS.withdraw} verb="Withdraw" busy={!!busy}
            onSubmit={a => run('withdraw', () => vaultWithdraw(info, a), `Withdrew ${a} HRV to your wallet`)} />
          {info.testToken && <button className="btn-wood self-start !py-0.5 text-sm" disabled={!!busy} onClick={() => run('faucet', () => testFaucet(info), 'Received 10,000 test HRV')}>Get test HRV (faucet)</button>}
          {busy && <span className="text-sm">{busy === 'deposit' || busy === 'withdraw' || busy === 'faucet' ? 'Waiting for your wallet and the chain…' : busy}</span>}
          {err && <span className="text-sm text-down">{err}</span>}
        </>}
      </Card>

      <Card className="md:col-span-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2"><Icon name="trophy" /><b className="text-lg">Farmer rewards</b></div>
        {linked && me ? <>
          <b className="text-2xl text-gold-d">{fmt(me.rewards.claimable)} HRV <span className="text-sm font-normal text-muted">to claim</span></b>
          <span className="text-xs text-muted">Earned {fmt(me.rewards.earned)} · claimed {fmt(me.rewards.claimed)}</span>
          <button className="btn-gold self-start !py-0.5" disabled={!!busy || BigInt(me.rewards.claimable) === 0n}
            onClick={() => run('claim', async () => { await claimHrvRewards(currentToken()!); }, 'Rewards paid into your Game Vault')}>Claim into vault</button>
        </> : <span className="text-sm text-muted">Sign in with your wallet to earn rewards.</span>}
        <p className="m-0 text-xs leading-snug text-muted">Delivery contracts earn $HRV for wallet-linked farms, up to a daily limit. Claims are paid from the reward treasury only — never beyond what it holds — and there are no guaranteed returns.</p>
      </Card>

      <Card className="md:col-span-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2"><Icon name="chart" /><b className="text-lg">Treasury</b>
          <span className={`ml-auto border-2 border-wood-d px-1.5 text-[11px] font-bold ${s.solvent ? 'bg-leaf text-white' : 'bg-down text-white'}`}>{s.solvent ? 'Fully backed ✓' : 'Check solvency'}</span>
          {s.paused && <span className="border-2 border-wood-d bg-down px-1.5 text-[11px] font-bold text-white">Paused</span>}</div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
          <div><b className="block text-lg">{fmt(s.totalBurned)}</b><span className="text-xs text-muted">HRV burned</span></div>
          <div><b className="block text-lg">{fmt(s.rewardReserve)}</b><span className="text-xs text-muted">Reward treasury</span></div>
          <div><b className="block text-lg">{fmt(s.playerBalances)}</b><span className="text-xs text-muted">Player balances</span></div>
          <div><b className="block text-lg">{fmt(s.rewardsPaid)}</b><span className="text-xs text-muted">Rewards paid</span></div>
        </div>
        <b className="text-sm">Burn &amp; treasury history</b>
        <div className="max-h-36 overflow-y-auto text-xs">
          {history.data?.events.length ? history.data.events.map(e => (
            <div key={`${e.txHash}-${e.kind}`} className="flex gap-2 border-b border-parch-d py-0.5">
              <span className="w-24 font-semibold">{e.kind === 'Spent' ? 'Purchase' : e.kind === 'Burned' ? 'Burn' : e.kind === 'RewardsFunded' ? 'Treasury funded' : 'Reward claim'}</span>
              <span className="flex-1">{fmt(e.amount)} HRV{e.kind === 'Spent' ? ` (${fmt(e.extra.burned)} burned, ${fmt(e.extra.toRewards)} to rewards)` : ''}{e.player && e.kind !== 'Burned' ? ` · ${shortAddress(e.player)}` : ''}</span>
              <span className="text-muted">{new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <TxLink chainId={info.chainId!} hash={e.txHash} />
            </div>
          )) : <span className="text-muted">No purchases or burns yet.</span>}
        </div>
        {linked && me && me.purchases.length > 0 && <>
          <b className="text-sm">Your $HRV purchases</b>
          <div className="text-xs">{me.purchases.slice(0, 5).map(p => (
            <div key={p.id} className="flex gap-2 py-0.5">
              <span className="flex-1">{p.qty} × {ITEM[p.item]?.name ?? p.item} · {fmt(p.amountWei)} HRV</span>
              <span className={p.status === 'settled' ? 'text-up' : p.status === 'failed' ? 'text-down' : 'text-muted'}>{p.status}</span>
              {p.txHash && <TxLink chainId={info.chainId!} hash={p.txHash} />}
            </div>
          ))}</div>
        </>}
      </Card>
    </>
  );
}
