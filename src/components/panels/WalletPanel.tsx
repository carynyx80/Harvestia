'use client';
// Wallet connection, sign-in with a signed message, live balances, and the Game Vault.
import { useState } from 'react';
import { useConnect, useDisconnect, useSwitchChain, type Connector } from 'wagmi';
import { VAULT_FEES } from '@/game/data/economy';
import { DEFAULT_CHAIN, HRV_CHAIN_ID, HRV_TOKEN, shortAddress, signInWithWallet, walletAppLinks } from '@/lib/wallet';
import { signOut } from '@/lib/sync';
import { useGame } from '@/store/game';
import { Card, Window } from '@/components/ui/kit';
import { VaultSection } from '@/components/wallet/VaultSection';
import { Icon } from '@/components/hud/Icon';
import { fmtToken, useWalletData } from '@/components/wallet/useWalletData';

const OUTCOME = {
  linked: 'Wallet linked — this farm now belongs to your wallet and can be opened on any device',
  'signed-in': 'Signed in — loaded the farm that belongs to this wallet',
  created: 'Signed in — a new farm was created for this wallet',
} as const;

/** Friendly text for wallet errors (users rejecting a request is the common case). */
const reason = (e: unknown) => {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? 'Something went wrong';
  if (/reject|denied|cancel/i.test(m)) return 'Request cancelled in the wallet';
  if (/Unrecognized chain|wallet_addEthereumChain|4902/i.test(m)) return 'Your wallet could not add Robinhood Chain — add it manually (chain ID 4663) and try again';
  return m.length > 160 ? `${m.slice(0, 160)}…` : m;
};

function ConnectorButton({ c, onPick, busy }: { c: Connector; onPick: () => void; busy: boolean }) {
  return (
    <button className="btn-wood flex items-center gap-2 !py-1.5 text-left" onClick={onPick} disabled={busy}>
      {c.icon ? <img src={c.icon} alt="" className="size-6" /> : <Icon name="coin" size={22} />}
      <span className="flex-1">{c.name}</span>{busy && <small>opening…</small>}
    </button>
  );
}

function ConnectCard() {
  const { connectors, connect, isPending, variables, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const session = useGame(s => s.session), toast = useGame(s => s.toast);
  const w = useWalletData();
  const [signing, setSigning] = useState(false), [signError, setSignError] = useState('');
  const address = w.account.address;
  const signedIn = !!address && session?.wallet === address;

  // a discovered extension (EIP-6963) is clearer than the generic "Injected" entry
  const discovered = connectors.filter(c => c.type === 'injected' && c.id !== 'injected');
  const hasInjected = typeof window !== 'undefined' && !!(window as { ethereum?: unknown }).ethereum;
  const list = connectors.filter(c => c.id !== 'injected' || (!discovered.length && hasInjected));

  const doSignIn = async () => {
    setSigning(true); setSignError('');
    try { toast(OUTCOME[await signInWithWallet()], 'good'); } catch (e) { setSignError(reason(e)); } finally { setSigning(false); }
  };

  if (!address) return (
    <Card className="md:col-span-2 flex flex-col gap-2">
      <b className="text-lg">Connect a wallet</b>
      {session?.wallet && <p className="m-0 text-sm">This farm is linked to <b>{shortAddress(session.wallet)}</b>. Connect that wallet to see its balances.</p>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {list.map(c => <ConnectorButton key={c.uid} c={c} busy={isPending && variables?.connector === c} onPick={() => connect({ connector: c, chainId: DEFAULT_CHAIN.id })} />)}
      </div>
      {!discovered.length && !hasInjected && (
        <div className="flex flex-col gap-1.5 text-sm">
          <span>No browser wallet found. On a computer, install MetaMask, Rabby or Coinbase Wallet and reload. On a phone, open Harvestia in your wallet app:</span>
          <div className="flex flex-wrap gap-1.5">{walletAppLinks(window.location.href).map(l => <a key={l.name} className="btn-wood !py-0.5 text-sm" href={l.href}>{l.name}</a>)}</div>
        </div>
      )}
      {error && <p className="m-0 text-sm text-down">{reason(error)}</p>}
    </Card>
  );

  return (
    <Card className="md:col-span-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-lg">{shortAddress(address)}</b>
        <span className="text-xs text-muted">via {w.account.connector?.name}</span>
        <span className={`border-2 border-wood-d px-1.5 text-[11px] font-bold ${w.onRobinhood ? 'bg-leaf text-white' : 'bg-gold text-ink'}`}>{w.onRobinhood ? DEFAULT_CHAIN.name : `Chain ${w.account.chainId}`}</span>
        {signedIn && <span className="border-2 border-wood-d bg-leaf px-1.5 text-[11px] font-bold text-white">Signed in ✓</span>}
        <a className="ml-auto text-xs underline" href={`${DEFAULT_CHAIN.blockExplorers!.default.url}/address/${address}`} target="_blank" rel="noreferrer">View on explorer</a>
      </div>
      {!w.onRobinhood && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Harvestia runs on {DEFAULT_CHAIN.name}.</span>
          <button className="btn-gold !py-0.5" disabled={switching} onClick={() => switchChain({ chainId: DEFAULT_CHAIN.id })}>{switching ? 'Switching…' : `Switch to ${DEFAULT_CHAIN.name}`}</button>
          {switchError && <span className="text-down">{reason(switchError)}</span>}
        </div>
      )}
      {!signedIn && (
        <div className="flex flex-col gap-1 border-2 border-dashed border-parch-d p-2 text-sm">
          <span>Sign a one-time message to prove this wallet is yours and link it to {session?.wallet ? 'its farm' : 'your farm'}. It costs nothing and cannot move tokens.</span>
          <div className="flex items-center gap-2">
            <button className="btn-gold !py-0.5" disabled={signing} onClick={doSignIn}>{signing ? 'Check your wallet…' : 'Sign in with wallet'}</button>
            {signError && <span className="text-down">{signError}</span>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button className="btn-wood !py-0.5 text-sm" onClick={() => disconnect()}>Disconnect wallet</button>
        {session?.wallet && <button className="btn-wood !py-0.5 text-sm" onClick={() => { disconnect(); void signOut().then(() => toast('Signed out — playing as a new guest. Sign in with your wallet to return to your farm', 'info')); }}>Sign out</button>}
      </div>
    </Card>
  );
}

export function WalletPanel() {
  const close = useGame(s => s.closePanel);
  const w = useWalletData();
  const connected = !!w.account.address;
  return (
    <Window title="Wallet & Game Vault" icon="vault" onClose={close} width={760}
      footer="Harvestia never asks for your seed phrase or private key. Signing in and paying for items only sign messages; deposits and withdrawals are transactions you confirm in your wallet, with fees shown first. The vault contract is unaudited and runs on test networks only until an independent audit.">
      <div className="grid gap-3 md:grid-cols-2">
        <ConnectCard />
        <Card className="flex flex-col gap-1">
          <div className="flex items-center gap-2"><Icon name="coin" /><b className="text-lg">Wallet balance</b></div>
          {!connected ? <b className="text-3xl text-gold-d">— HRV</b>
            : w.hrvLaunched ? <b className="text-3xl text-gold-d">{fmtToken(w.hrv, 2)} {w.hrvSymbol}</b>
            : <b className="text-xl text-gold-d">$HRV not launched yet</b>}
          <p className="m-0 text-sm leading-snug">
            {w.hrvLaunched
              ? <>Read from the $HRV token contract ({shortAddress(HRV_TOKEN!)}) on chain {HRV_CHAIN_ID} every 30 seconds — no need to type your holdings.</>
              : <>$HRV launches on Ponsfamily. Once its contract address is set here, your balance is read from the chain automatically.</>}
          </p>
          {connected && <p className="m-0 text-sm">Gas balance: <b>{w.ethLoading ? '…' : `${fmtToken(w.eth)} ETH`}</b> on {DEFAULT_CHAIN.name}</p>}
          {w.hrvError && <p className="m-0 text-xs text-down">Couldn&apos;t read the token: {w.hrvError.slice(0, 120)}</p>}
        </Card>
        <VaultSection />
        <Card className="md:col-span-2">
          <div className="grid gap-2 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <div><b>Your wallet</b><div className="text-xs text-muted">{DEFAULT_CHAIN.name}</div></div>
            <div className="text-sm">deposit → <b>{VAULT_FEES.deposit * 100}% fee</b></div>
            <div><b>Game Vault</b><div className="text-xs text-muted">in-game balance</div></div>
            <div className="text-sm">← withdraw <b>{VAULT_FEES.withdraw * 100}% fee</b></div>
            <div><b>Purchases</b><div className="text-xs text-muted">50% burned · 50% reward treasury</div></div>
          </div>
        </Card>
      </div>
    </Window>
  );
}
