'use client';
import { useEffect } from 'react';
import { useGame, type Tool } from '@/store/game';
import { Icon, type IconName } from './Icon';

const TOOLS: { key: Tool; label: string; icon: IconName }[] = [
  { key: 'plant', label: 'Plant', icon: 'seed' }, { key: 'water', label: 'Water', icon: 'water' },
  { key: 'harvest', label: 'Harvest', icon: 'harvest' }, { key: 'build', label: 'Build', icon: 'build' },
  { key: 'upgrade', label: 'Upgrade', icon: 'upgrade' }, { key: 'inventory', label: 'Inventory', icon: 'bag' },
];

export function Toolbar() {
  const tool = useGame(s => s.tool), setTool = useGame(s => s.setTool);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= TOOLS.length) setTool(TOOLS[n - 1].key); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [setTool]);
  return (
    <div className="panel-dark pointer-events-auto absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5 p-2" role="toolbar" aria-label="Farm tools">
      {TOOLS.map((t, k) => (
        <button
          key={t.key}
          onClick={() => setTool(t.key)}
          className={`relative flex h-[66px] w-12 flex-col items-center gap-0.5 border-[3px] border-wood-d pt-1 text-ink transition-transform sm:w-[62px] ${tool === t.key ? '-translate-y-[3px] bg-[#fff0b8] shadow-[inset_0_-4px_0_#e3b341,0_0_0_3px_#f2c94c]' : 'bg-parch shadow-[inset_0_-4px_0_#d8bd82] hover:bg-parch-l'}`}
          aria-pressed={tool === t.key}
        >
          <kbd className="absolute top-px left-[3px] text-[10px] font-semibold text-muted">{k + 1}</kbd>
          <Icon name={t.icon} size={32} />
          <span className="text-[10px] font-semibold sm:text-xs">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
