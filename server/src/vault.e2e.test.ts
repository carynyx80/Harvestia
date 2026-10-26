// End-to-end test of the Game Vault against a real local chain. Run a Hardhat node and the
// deploy script first (see contracts/README), then: E2E_DEPLOYMENT=../contracts/deployments/localhost.json npm test
// Uses Hardhat's well-known public test accounts plus a throwaway player key — never real keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createPublicClient, createWalletClient, defineChain, erc20Abi, formatUnits, http, parseUnits, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { buildApp } from './app';
import { MemoryStore } from './store/memory';
import { SIGN_IN_STATEMENT, NONCE_TTL_MS } from '../../shared/chains';
import { VAULT_ABI } from '../../shared/vault';
import { makeContract } from '../../shared/sim/engine';

const file = process.env.E2E_DEPLOYMENT;
const KEYS = {
  deployer: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  settler: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  rewardSigner: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
} as const;

test('deposit, buy with HRV, burn, and claim rewards on a local chain', { skip: !file || !existsSync(file) ? 'no local deployment (set E2E_DEPLOYMENT)' : false }, async () => {
  const d = JSON.parse(readFileSync(file!, 'utf8')) as { chainId: number; token: Address; vault: Address; deployedBlock: number };
  const chain = defineChain({ id: d.chainId, name: 'local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } } });
  const pub = createPublicClient({ chain, transport: http() });
  // a fresh player every run, so the test can be repeated on the same chain
  const player = privateKeyToAccount(generatePrivateKey()), deployer = privateKeyToAccount(KEYS.deployer);
  const pw = createWalletClient({ account: player, chain, transport: http() }), dw = createWalletClient({ account: deployer, chain, transport: http() });
  const wait = async (hash: Hex) => { const r = await pub.waitForTransactionReceipt({ hash }); assert.equal(r.status, 'success'); };

  const store = new MemoryStore();
  const app = await buildApp({
    store, redisUrl: undefined, runJobs: false, provider: null,
    vault: { chainId: d.chainId, rpc: 'http://127.0.0.1:8545', vault: d.vault, token: d.token, testToken: true, startBlock: BigInt(d.deployedBlock), settlerKey: KEYS.settler, rewardSignerKey: KEYS.rewardSigner, testUsdPerHrv: 0.01, rewardPerContract: 5, rewardDailyCap: 50 },
  });
  const info = (await app.inject({ method: 'GET', url: '/v1/vault' })).json();
  assert.equal(info.enabled, true, JSON.stringify(info));

  // sign in with the wallet (links it to a fresh farm)
  const nonce = (await app.inject({ method: 'POST', url: '/v1/wallet/nonce' })).json().nonce;
  const message = createSiweMessage({ address: player.address, chainId: d.chainId, domain: 'localhost:5180', uri: 'http://localhost:5180', nonce, version: '1', statement: SIGN_IN_STATEMENT, issuedAt: new Date(), expirationTime: new Date(Date.now() + NONCE_TTL_MS) });
  const s = (await app.inject({ method: 'POST', url: '/v1/wallet/verify', payload: { message, signature: await player.signMessage({ message }) } })).json();
  assert.equal(s.ok, true, JSON.stringify(s));
  const auth = { authorization: `Bearer ${s.token}` };

  // fund the player with gas and test HRV, then deposit 1,000 (3% fee → 970 credited)
  await wait(await dw.sendTransaction({ to: player.address, value: parseUnits('1', 18) }));
  await wait(await dw.writeContract({ address: d.token, abi: erc20Abi, functionName: 'transfer', args: [player.address, parseUnits('5000', 18)] }));
  await wait(await pw.writeContract({ address: d.token, abi: erc20Abi, functionName: 'approve', args: [d.vault, parseUnits('1000', 18)] }));
  const before = await pub.readContract({ address: d.vault, abi: VAULT_ABI, functionName: 'balanceOf', args: [player.address] }) as bigint;
  await wait(await pw.writeContract({ address: d.vault, abi: VAULT_ABI, functionName: 'deposit', args: [parseUnits('1000', 18)] }));
  const me = (await app.inject({ method: 'GET', url: '/v1/vault/me', headers: auth })).json();
  assert.equal(BigInt(me.balance) - before, parseUnits('970', 18));

  // quote a coop ($1 → 100 HRV at the $0.01 test price), sign it, buy it
  const supply0 = await pub.readContract({ address: d.token, abi: erc20Abi, functionName: 'totalSupply' });
  const q = (await app.inject({ method: 'POST', url: '/v1/vault/quote', headers: auth, payload: { item: 'bld-coop', qty: 1 } })).json();
  assert.equal(q.ok, true, JSON.stringify(q));
  assert.equal(q.hrv, '100');
  const msg = { player: player.address, amount: BigInt(q.amountWei), purchaseId: q.purchaseId as Hex, deadline: BigInt(q.deadline) };
  const sig = await player.signTypedData({ domain: q.typedData.domain, types: q.typedData.types, primaryType: 'Spend', message: msg });
  const buyRes = (await app.inject({ method: 'POST', url: '/v1/vault/purchase', headers: auth, payload: { purchaseId: q.purchaseId, signature: sig } })).json();
  assert.equal(buyRes.ok, true, JSON.stringify(buyRes));
  assert.equal(buyRes.state.buildings['bld-coop'], 1);
  const supply1 = await pub.readContract({ address: d.token, abi: erc20Abi, functionName: 'totalSupply' });
  assert.equal(supply0 - supply1, parseUnits('50', 18)); // half burned for real
  // the same signed quote can't be used again
  const again = await app.inject({ method: 'POST', url: '/v1/vault/purchase', headers: auth, payload: { purchaseId: q.purchaseId, signature: sig } });
  assert.equal(again.statusCode, 409);
  // a quote signed for less than it costs is refused on-chain and nothing is granted
  const q2 = (await app.inject({ method: 'POST', url: '/v1/vault/quote', headers: auth, payload: { item: 'bld-coop', qty: 1 } })).json();
  const lowSig = await player.signTypedData({ domain: q2.typedData.domain, types: q2.typedData.types, primaryType: 'Spend', message: { ...msg, purchaseId: q2.purchaseId, amount: 1n, deadline: BigInt(q2.deadline) } });
  const bad = (await app.inject({ method: 'POST', url: '/v1/vault/purchase', headers: auth, payload: { purchaseId: q2.purchaseId, signature: lowSig } })).json();
  assert.equal(bad.ok, false);
  assert.match(bad.error, /bad signature/);

  // the indexer records the purchase and the burn
  assert.ok(await app.vault.index() >= 3);
  const hist = (await app.inject({ method: 'GET', url: '/v1/vault/history' })).json();
  assert.ok(hist.events.some((e: { kind: string }) => e.kind === 'Spent'));
  assert.ok(hist.events.some((e: { kind: string }) => e.kind === 'Burned'));

  // deliver a contract → earn 5 HRV → claim it into the vault (paid from the 50 HRV that went to rewards)
  await store.withFarm(s.player.id, farm => {
    const c = { ...makeContract(9999, 3, Date.now()), items: [['prod-egg', 1]] as [string, number][] };
    return { next: { ...farm, state: { ...farm.state, contracts: [c, ...farm.state.contracts.slice(1)] } }, value: null };
  });
  const delivered = (await app.inject({ method: 'POST', url: '/v1/farm/actions', headers: auth, payload: { seq: 1, action: { type: 'deliver', index: 0 } } })).json();
  assert.equal(delivered.ok, true, JSON.stringify(delivered));
  assert.ok(delivered.events.some((e: { text?: string }) => /HRV reward/.test(e.text ?? '')));
  const v0 = BigInt((await app.inject({ method: 'GET', url: '/v1/vault/me', headers: auth })).json().balance);
  const claim = (await app.inject({ method: 'POST', url: '/v1/vault/claim', headers: auth })).json();
  assert.equal(claim.ok, true, JSON.stringify(claim));
  const v1 = BigInt((await app.inject({ method: 'GET', url: '/v1/vault/me', headers: auth })).json().balance);
  assert.equal(formatUnits(v1 - v0, 18), '5');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/vault/claim', headers: auth })).statusCode, 400); // nothing left

  const stats = (await app.inject({ method: 'GET', url: '/v1/vault' })).json().stats;
  assert.equal(stats.solvent, true);
  await app.close();
});
