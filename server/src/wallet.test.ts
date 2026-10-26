import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { buildApp } from './app';
import { MemoryStore } from './store/memory';
import { SIGN_IN_STATEMENT, NONCE_TTL_MS } from '../../shared/chains';

// throwaway keys generated for each run — never real wallets
const wallet = () => privateKeyToAccount(generatePrivateKey());

async function setup() {
  const store = new MemoryStore();
  const app = await buildApp({ store, redisUrl: undefined, runJobs: false, provider: null });
  const nonce = async () => (await app.inject({ method: 'POST', url: '/v1/wallet/nonce' })).json().nonce as string;
  const message = (address: `0x${string}`, n: string, over: Partial<Parameters<typeof createSiweMessage>[0]> = {}) => createSiweMessage({
    address, chainId: 4663, domain: 'localhost:5180', uri: 'http://localhost:5180', nonce: n, version: '1',
    statement: SIGN_IN_STATEMENT, issuedAt: new Date(), expirationTime: new Date(Date.now() + NONCE_TTL_MS), ...over,
  });
  const verify = (msg: string, signature: string, token?: string) => app.inject({
    method: 'POST', url: '/v1/wallet/verify', payload: { message: msg, signature }, headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { app, store, nonce, message, verify };
}

test('links a wallet to the guest farm, and the same wallet restores that farm on another device', async () => {
  const { app, nonce, message, verify } = await setup();
  const guest = (await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} })).json();
  const w = wallet();
  const msg = message(w.address, await nonce());
  const r = await verify(msg, await w.signMessage({ message: msg }), guest.token);
  assert.equal(r.statusCode, 200, r.body);
  const linked = r.json();
  assert.equal(linked.outcome, 'linked');
  assert.equal(linked.farm.id, guest.farm.id);
  assert.equal(linked.player.wallet, w.address);
  const me = (await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${linked.token}` } })).json();
  assert.equal(me.player.wallet, w.address);

  // the same signature can't be used twice
  const replay = await verify(msg, await w.signMessage({ message: msg }));
  assert.equal(replay.statusCode, 400);
  assert.match(replay.json().error, /already used/);

  // a new device with no session signs in to the same farm
  const msg2 = message(w.address, await nonce());
  const again = (await verify(msg2, await w.signMessage({ message: msg2 }))).json();
  assert.equal(again.outcome, 'signed-in');
  assert.equal(again.farm.id, guest.farm.id);
});

test('a new wallet with no session gets its own farm', async () => {
  const { nonce, message, verify } = await setup();
  const w = wallet(), msg = message(w.address, await nonce());
  const r = (await verify(msg, await w.signMessage({ message: msg }))).json();
  assert.equal(r.outcome, 'created');
  assert.ok(r.farm.id && r.token);
});

test('rejects forged, foreign, expired and off-chain sign-ins', async () => {
  const { nonce, message, verify } = await setup();
  const w = wallet(), other = wallet();
  const bad = async (msg: string, sig?: string) => { const r = await verify(msg, sig ?? await w.signMessage({ message: msg })); assert.equal(r.statusCode, 400, r.body); return r.json().error as string; };
  // signed by a different key than the address in the message
  const m1 = message(w.address, await nonce());
  assert.match(await bad(m1, await other.signMessage({ message: m1 })), /does not match/);
  // made for a phishing site
  assert.match(await bad(message(w.address, await nonce(), { domain: 'evil.example', uri: 'https://evil.example' })), /another site/);
  // wrong network
  assert.match(await bad(message(w.address, await nonce(), { chainId: 1 })), /Robinhood Chain/);
  // too old
  assert.match(await bad(message(w.address, await nonce(), { issuedAt: new Date(Date.now() - 2 * NONCE_TTL_MS), expirationTime: new Date(Date.now() - NONCE_TTL_MS) })), /expired/);
  // a nonce the server never issued
  assert.match(await bad(message(w.address, 'deadbeefdeadbeefdeadbeefdeadbeef')), /already used or has expired/);
  // changed statement
  assert.match(await bad(message(w.address, await nonce(), { statement: 'Approve all tokens' })), /statement/);
  assert.equal((await verify('hello', '0x1234')).statusCode, 400);
});

test('logout ends the session', async () => {
  const { app } = await setup();
  const g = (await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} })).json();
  const h = { authorization: `Bearer ${g.token}` };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: h })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: h })).statusCode, 401);
});
