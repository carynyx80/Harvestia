import { GameCanvas } from '@/components/GameCanvas';
import { Hud } from '@/components/hud/Hud';
import { LaunchGate } from '@/components/LaunchGate';

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      <GameCanvas />
      <Hud />
      <LaunchGate />
    </main>
  );
}
