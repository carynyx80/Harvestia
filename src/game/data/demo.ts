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

export const STORAGE_CAPACITY = 60;

export interface Machine { id: string; item: string; level: number; maxLevel: number; condition: number; status: string; upgradeUsd: number }
export const MACHINES: Machine[] = [
  { id: 'm1', item: 'mach-tractor', level: 2, maxLevel: 5, condition: .82, status: 'Working field 2', upgradeUsd: 6 },
  { id: 'm2', item: 'mach-harvester', level: 1, maxLevel: 5, condition: .95, status: 'Parked at the shed', upgradeUsd: 8 },
  { id: 'm3', item: 'mach-pump', level: 1, maxLevel: 3, condition: .64, status: 'Watering the paddy', upgradeUsd: 4 },
  { id: 'm4', item: 'mach-can', level: 1, maxLevel: 3, condition: 1, status: 'In your hands · 8 / 10 water', upgradeUsd: 2 },
];

export { INVENTORY, ANIMALS, type Animal } from '../../../shared/starter';

export const TASKS: { text: string; done: boolean }[] = [
  { text: 'Harvest the ripe wheat and corn fields', done: false },
  { text: 'Feed Bluebell, Fluff and Hamlet', done: false },
  { text: 'Collect eggs from the coop', done: true },
  { text: 'Deliver 120 wheat to the contract board', done: false },
  { text: 'Water the tomato field', done: true },
];
