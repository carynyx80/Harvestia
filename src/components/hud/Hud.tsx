'use client';
import { CommodityBoard } from './CommodityBoard';
import { Inspector } from './Inspector';
import { LeftNav } from './LeftNav';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { HoverTip, LoadingScreen, MinimapFrame, ViewControls, ZoneLabels } from './WorldOverlays';

/** Everything drawn over the Phaser canvas. The container ignores the pointer so the world stays draggable. */
export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="vignette absolute inset-0" />
      <ZoneLabels />
      <TopBar />
      <LeftNav />
      <CommodityBoard />
      <Inspector />
      <MinimapFrame />
      <ViewControls />
      <Toolbar />
      <HoverTip />
      <LoadingScreen />
    </div>
  );
}
