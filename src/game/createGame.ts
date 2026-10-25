import * as Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';

export function createGame(parent: HTMLElement) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d3a1f',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    input: { mouse: { preventDefaultWheel: true } },
    scene: [WorldScene],
  });
  // handy for inspecting the world from the browser console during development
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __harvestia: Phaser.Game }).__harvestia = game;
  return game;
}
