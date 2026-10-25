import { GameCanvas } from '@/components/GameCanvas';
import { Hud } from '@/components/hud/Hud';

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      <GameCanvas />
      <Hud />
    </main>
  );
}
