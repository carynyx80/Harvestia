'use client';
import { useEffect, useRef } from 'react';
import HV from '@/game/art/sprites';

export type IconName = 'home' | 'bag' | 'cow' | 'tractor' | 'stall' | 'chart' | 'coop' | 'trophy' | 'seed' | 'water' | 'harvest' | 'build' | 'upgrade' | 'coin' | 'vault' | 'sun' | 'cloud' | 'rain' | 'gear';

/** 12×12 pixel icon scaled with nearest-neighbour. */
export function Icon({ name, size = 24, className = '' }: { name: IconName; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/${name}.png`} alt="" width={size} height={size} className={`pixel inline-block shrink-0 ${className}`} />;
}

/** Draws a sprite-library sprite into a small canvas (avatar, crop icons). */
export function Sprite({ w, h, scale = 2, draw, className = '' }: { w: number; h: number; scale?: number; draw: () => void; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h); HV.use(g); draw();
  }, [w, h, draw]);
  return <canvas ref={ref} width={w} height={h} className={`pixel ${className}`} style={{ width: w * scale, height: h * scale }} />;
}
