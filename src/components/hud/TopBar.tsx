'use client';
import HV from '@/game/art/sprites';
import { Icon, Sprite, type IconName } from './Icon';

const drawAvatar = () => HV.farmer(2, 1, 0, false, { shirt: '#c4553b', pants: '#3f6fa8' }, 'front');

function Pill({ icon, label, value, tone = 'gold', title }: { icon: IconName; label: string; value: string; tone?: 'gold' | 'green' | 'white'; title: string }) {
  const color = tone === 'gold' ? 'text-gold' : tone === 'green' ? 'text-[#b9ec8a]' : 'text-white';
  return (
    <div className="panel-dark flex items-center gap-2 py-1 pr-3 pl-1.5" title={title}>
      <Icon name={icon} />
      <div className="leading-none">
        <small className="block text-[11px] text-parch-d">{label}</small>
        <b className={`block text-base ${color}`}>{value}</b>
      </div>
    </div>
  );
}

export function TopBar() {
  return (
    <header className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start gap-2.5">
      <div className="logo-glow pointer-events-auto -mt-1 w-[124px] shrink-0 sm:w-[168px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/harvestia-logo-480.png" alt="Harvestia" className="block h-auto w-full drop-shadow-[0_3px_0_rgba(20,10,4,.55)]" />
      </div>
      <div className="panel pointer-events-auto mt-1 hidden items-center gap-2.5 py-2 pr-3 pl-2 lg:flex">
        <div className="grid size-[46px] place-items-center border-[3px] border-wood-d bg-[#9fd3e6] shadow-[inset_0_-10px_0_#5fb44b]">
          <Sprite w={13} h={16} scale={3} draw={drawAvatar} className="mt-1.5" />
        </div>
        <div>
          <div className="text-[17px] font-bold whitespace-nowrap">Sunny Acres <span className="ml-1 border-2 border-[#2c6e2c] bg-leaf px-1.5 text-[13px] text-white">Lv 7</span></div>
          <div className="relative mt-1 h-4 w-[168px] border-2 border-wood-d bg-[#6b4a2e]">
            <i className="xp-fill absolute inset-y-0 left-0" style={{ width: '62%' }} />
            <b className="relative block text-center text-[11px] leading-3 font-semibold text-white [text-shadow:0_1px_0_#2a1a10]">1,240 / 2,000 XP</b>
          </div>
        </div>
      </div>
      <div className="pointer-events-auto mt-1 ml-auto flex flex-wrap items-center justify-end gap-2">
        <Pill icon="coin" label="Wallet" value="— HRV" title="Read from the $HRV ERC-20 contract once wallets connect (Stage 8)" />
        <Pill icon="vault" label="Game Vault" value="— HRV" title="Deposited $HRV available for in-game spending (Stage 8)" />
        <div className="hidden md:block"><Pill icon="seed" label="Farm Coins · sim" value="1,250" tone="green" title="Simulated currency until on-chain integration" /></div>
        <div className="hidden xl:block"><Pill icon="sun" label="Spring · Day 12" value="Sunny 24°" tone="white" title="Weather and seasons arrive in Stage 3" /></div>
        <button className="btn-gold" disabled title="Wallet connection arrives in Stage 8">Connect Wallet</button>
        <button className="btn-wood grid size-10 place-items-center !p-0" title="Settings"><Icon name="gear" /></button>
      </div>
    </header>
  );
}
