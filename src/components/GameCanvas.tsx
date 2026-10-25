'use client';
import { useEffect, useRef } from 'react';

/** Mounts the Phaser world. Phaser touches `window`, so it is loaded client-side only. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: { destroy(removeCanvas: boolean): void } | undefined;
    let cancelled = false;
    import('@/game/createGame').then(({ createGame }) => {
      if (!cancelled && ref.current) game = createGame(ref.current);
    });
    return () => { cancelled = true; game?.destroy(true); };
  }, []);
  return <div ref={ref} className="game-canvas absolute inset-0" aria-label="Harvestia world" />;
}
