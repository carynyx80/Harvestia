// The starter farm every new player begins with (shared by client and server).

/** item id → quantity; `quality` 1–3 stars for produce */
export const INVENTORY: { id: string; qty: number; quality?: number }[] = [
  { id: 'crop-wheat', qty: 146, quality: 2 }, { id: 'crop-corn', qty: 88, quality: 3 }, { id: 'crop-soy', qty: 42, quality: 2 },
  { id: 'crop-potato', qty: 60, quality: 1 }, { id: 'crop-tomato', qty: 35, quality: 3 }, { id: 'crop-coffee', qty: 12, quality: 2 },
  { id: 'crop-cocoa', qty: 7, quality: 2 }, { id: 'crop-rice', qty: 54, quality: 2 },
  { id: 'seed-wheat', qty: 40 }, { id: 'seed-corn', qty: 24 }, { id: 'seed-tomato', qty: 18 }, { id: 'seed-potato', qty: 12 },
  { id: 'seed-coffee', qty: 6 }, { id: 'seed-rice', qty: 20 },
  { id: 'prod-egg', qty: 36, quality: 2 }, { id: 'prod-milk', qty: 14, quality: 3 }, { id: 'prod-wool', qty: 9, quality: 2 }, { id: 'prod-truffle', qty: 3, quality: 3 },
  { id: 'good-flour', qty: 22 }, { id: 'good-cheese', qty: 5 }, { id: 'good-sauce', qty: 8 },
  { id: 'feed-chicken', qty: 10 }, { id: 'feed-cattle', qty: 4 }, { id: 'feed-sheep', qty: 6 },
];
export interface Animal { name: string; kind: 'cow' | 'sheep' | 'pig' | 'chicken'; health: number; happiness: number; fed: number; product: string; readyIn: string }
export const ANIMALS: Animal[] = [
  { name: 'Daisy', kind: 'cow', health: .96, happiness: .9, fed: .8, product: 'Milk', readyIn: '2h 10m' },
  { name: 'Bluebell', kind: 'cow', health: .88, happiness: .75, fed: .4, product: 'Milk', readyIn: 'Ready' },
  { name: 'Clover', kind: 'cow', health: .92, happiness: .84, fed: .7, product: 'Milk', readyIn: '6h 40m' },
  { name: 'Woolly', kind: 'sheep', health: .9, happiness: .95, fed: .9, product: 'Wool', readyIn: '14h' },
  { name: 'Cotton', kind: 'sheep', health: .85, happiness: .7, fed: .5, product: 'Wool', readyIn: '3h 20m' },
  { name: 'Biscuit', kind: 'sheep', health: .99, happiness: .88, fed: .95, product: 'Wool', readyIn: 'Ready' },
  { name: 'Fluff', kind: 'sheep', health: .8, happiness: .66, fed: .3, product: 'Wool', readyIn: '20h' },
  { name: 'Truffle', kind: 'pig', health: .93, happiness: .97, fed: .85, product: 'Truffles', readyIn: '9h' },
  { name: 'Hamlet', kind: 'pig', health: .87, happiness: .8, fed: .6, product: 'Truffles', readyIn: 'Ready' },
  { name: 'Pumpkin', kind: 'pig', health: .9, happiness: .72, fed: .55, product: 'Truffles', readyIn: '12h' },
  { name: 'Henrietta', kind: 'chicken', health: .98, happiness: .9, fed: .9, product: 'Eggs', readyIn: 'Ready' },
  { name: 'Pip', kind: 'chicken', health: .91, happiness: .85, fed: .7, product: 'Eggs', readyIn: '1h 30m' },
  { name: 'Nugget', kind: 'chicken', health: .95, happiness: .93, fed: .8, product: 'Eggs', readyIn: '4h' },
  { name: 'Dot', kind: 'chicken', health: .9, happiness: .82, fed: .65, product: 'Eggs', readyIn: '2h 50m' },
  { name: 'Marigold', kind: 'chicken', health: .97, happiness: .91, fed: .85, product: 'Eggs', readyIn: 'Ready' },
  { name: 'Peanut', kind: 'chicken', health: .89, happiness: .78, fed: .6, product: 'Eggs', readyIn: '5h 10m' },
];
