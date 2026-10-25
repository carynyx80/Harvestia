// Demonstration player state for the Stage 4 interface. Real, server-owned
// state replaces this in Stage 6; nothing here is persisted or spendable.

export const PLAYER = {
  farm: 'Sunny Acres',
  farmer: 'Guest farmer',
  level: 7, xp: 1240, xpNext: 2000,
  joined: 'Spring, day 1',
  coins: 1250,
  stats: [
    ['Fields', '21'], ['Crops harvested', '1,482'], ['Animals', '16'], ['Machines', '4'],
    ['Contracts done', '12'], ['Co-op', 'None yet'],
  ] as [string, string][],
};

export const ACHIEVEMENTS: { name: string; desc: string; got: boolean; tier: 'gold' | 'silver' | 'bronze' }[] = [
  { name: 'First Harvest', desc: 'Harvest your first field.', got: true, tier: 'bronze' },
  { name: 'Green Thumb', desc: 'Grow all eight crops.', got: true, tier: 'silver' },
  { name: 'Rancher', desc: 'Own every kind of animal.', got: true, tier: 'silver' },
  { name: 'Mechanised', desc: 'Buy a tractor.', got: true, tier: 'bronze' },
  { name: 'Market Maker', desc: 'Complete 25 trades at the exchange.', got: false, tier: 'gold' },
  { name: 'Co-op Spirit', desc: 'Join a cooperative.', got: false, tier: 'silver' },
  { name: 'Contractor', desc: 'Deliver 50 contracts.', got: false, tier: 'gold' },
  { name: 'All Seasons', desc: 'Harvest in every season.', got: false, tier: 'bronze' },
];

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
export const STORAGE_CAPACITY = 60;

export interface Machine { id: string; item: string; level: number; maxLevel: number; condition: number; status: string; upgradeUsd: number }
export const MACHINES: Machine[] = [
  { id: 'm1', item: 'mach-tractor', level: 2, maxLevel: 5, condition: .82, status: 'Working field 2', upgradeUsd: 6 },
  { id: 'm2', item: 'mach-harvester', level: 1, maxLevel: 5, condition: .95, status: 'Parked at the shed', upgradeUsd: 8 },
  { id: 'm3', item: 'mach-pump', level: 1, maxLevel: 3, condition: .64, status: 'Watering the paddy', upgradeUsd: 4 },
  { id: 'm4', item: 'mach-can', level: 1, maxLevel: 3, condition: 1, status: 'In your hands · 8 / 10 water', upgradeUsd: 2 },
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

export const TASKS: { text: string; done: boolean }[] = [
  { text: 'Harvest the ripe wheat and corn fields', done: false },
  { text: 'Feed Bluebell, Fluff and Hamlet', done: false },
  { text: 'Collect eggs from the coop', done: true },
  { text: 'Deliver 120 wheat to the contract board', done: false },
  { text: 'Water the tomato field', done: true },
];
