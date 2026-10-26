'use client';
import HV from '@/game/art/sprites';
import { useGame } from '@/store/game';
import { WEATHER_LABEL, formatHour, isSnowing } from '@/game/env/environment';
import { xpForLevel } from '@/game/sim/rules';
import { Icon, Sprite, type IconName } from './Icon';
import { shortAddress } from '@/lib/wallet';
import { fmtToken, useWalletData } from '@/components/wallet/useWalletData';
import { useVault } from '@/components/wallet/VaultSection';
import { formatUnits } from 'viem';

const drawAvatar = () => HV.farmer(2, 1, 0, false, { shirt: '#c4553b', pants: '#3f6fa8' }, 'front');

function Pill({ icon, label, value, tone = 'gold', title, onClick }: { icon: IconName; label: string; value: string; tone?: 'gold' | 'green' | 'white'; title: string; onClick?: () => void }) {
  const color = tone === 'gold' ? 'text-gold' : tone === 'green' ? 'text-[#b9ec8a]' : 'text-white';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="panel-dark flex items-center gap-2 py-1 pr-3 pl-1.5 text-left" title={title} onClick={onClick}>
      <Icon name={icon} />
      <div className="leading-none">
        <small className="block text-[11px] text-parch-d">{label}</small>
        <b className={`block text-base ${color}`}>{value}</b>
      </div>
    </Tag>
  );
}

const SEASON_LABEL = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' } as const;

/** Live season, day, weather, temperature and clock from the world. */
function WeatherPill() {
  const env = useGame(s => s.env);
  const icon: IconName = isSnowing(env.season, env.weather) ? 'snow'
    : env.weather === 'sunny' ? (env.night > .5 ? 'moon' : 'sun')
    : env.weather === 'cloudy' ? 'cloud' : env.weather === 'rainy' ? 'rain' : env.weather === 'stormy' ? 'storm' : 'drought';
  const label = isSnowing(env.season, env.weather) ? 'Snow' : WEATHER_LABEL[env.weather];
  return <Pill icon={icon} label={`${SEASON_LABEL[env.season]} · Day ${env.seasonDay}${env.live ? '' : ' · preview'}`} value={`${label} ${env.temp}° · ${formatHour(env.hour)}`} tone="white" title={env.live ? 'Shared world weather — every farm has the same sky' : 'Preview only — your crops still follow the real world weather'} />;
}

export function TopBar() {
  const open = useGame(s => s.openPanel), farm = useGame(s => s.farm);
  const farmName = useGame(s => s.session?.farmName) ?? 'Sunny Acres', linked = useGame(s => s.session?.wallet ?? null);
  const w = useWalletData(), address = w.account.address;
  const vault = useVault();
  const vaultLabel = !vault.info?.enabled ? 'Not open' : vault.me ? `${fmtToken(Number(formatUnits(BigInt(vault.me.balance), 18)), 0)} HRV` : '— HRV';
  const hrvLabel = !address ? '— HRV' : !w.hrvLaunched ? 'Not launched' : `${fmtToken(w.hrv, 0)} ${w.hrvSymbol}`;
  const level = farm?.level ?? 1, xp = farm?.xp ?? 0, next = xpForLevel(level);
  return (
    <header className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start gap-2.5">
      <div className="logo-glow pointer-events-auto -mt-1 w-[124px] shrink-0 sm:w-[168px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/harvestia-logo-480.png" alt="Harvestia" className="block h-auto w-full drop-shadow-[0_3px_0_rgba(20,10,4,.55)]" />
      </div>
      <button className="panel pointer-events-auto mt-1 hidden items-center gap-2.5 py-2 pr-3 pl-2 text-left lg:flex" onClick={() => open('profile')} title="Farmer profile (P)">
        <div className="grid size-[46px] place-items-center border-[3px] border-wood-d bg-[#9fd3e6] shadow-[inset_0_-10px_0_#5fb44b]">
          <Sprite w={13} h={16} scale={3} draw={drawAvatar} className="mt-1.5" />
        </div>
        <div>
          <div className="text-[17px] font-bold whitespace-nowrap">{farmName} <span className="ml-1 border-2 border-[#2c6e2c] bg-leaf px-1.5 text-[13px] text-white">Lv {level}</span></div>
          <div className="relative mt-1 h-4 w-[168px] border-2 border-wood-d bg-[#6b4a2e]">
            <i className="xp-fill absolute inset-y-0 left-0" style={{ width: `${Math.min(100, xp / next * 100)}%` }} />
            <b className="relative block text-center text-[11px] leading-3 font-semibold text-white [text-shadow:0_1px_0_#2a1a10]">{xp.toLocaleString('en-US')} / {next.toLocaleString('en-US')} XP</b>
          </div>
        </div>
      </button>
      <div className="pointer-events-auto mt-1 ml-auto flex flex-wrap items-center justify-end gap-2">
        <Pill icon="coin" label="Wallet" value={hrvLabel} title={address ? 'Your $HRV balance, read from Robinhood Chain' : 'Connect a wallet to read your $HRV balance'} onClick={() => open('wallet')} />
        <Pill icon="vault" label="Game Vault" value={vaultLabel} title={vault.info?.enabled ? 'Deposited $HRV available for in-game spending' : vault.info?.reason ?? 'Game Vault'} onClick={() => open('wallet')} />
        <div className="hidden md:block"><Pill icon="seed" label="Farm Coins · sim" value={(farm?.coins ?? 0).toLocaleString('en-US')} tone="green" title="Simulated currency for everyday play; $HRV purchases use your Game Vault" onClick={() => open('inventory')} /></div>
        <div className="hidden md:block"><WeatherPill /></div>
        {address && linked === address
          ? <button className="btn-wood flex items-center gap-1.5" onClick={() => open('wallet')} title="Signed in with this wallet (V)"><i className="inline-block size-2 border border-wood-d bg-[#4ce06a]" />{shortAddress(address)}</button>
          : <button className="btn-gold" onClick={() => open('wallet')} title="Connect and sign in with your wallet (V)">{address ? 'Sign in' : 'Connect Wallet'}</button>}
        <a className="btn-wood grid size-10 place-items-center !p-0 text-xl font-bold leading-none no-underline" href="https://x.com/Harvestiaa" target="_blank" rel="noreferrer" title="Follow Harvestia on X (@Harvestiaa)" aria-label="Harvestia on X">𝕏</a>
        <button className="btn-wood grid size-10 place-items-center !p-0" title="Settings"><Icon name="gear" /></button>
      </div>
    </header>
  );
}
