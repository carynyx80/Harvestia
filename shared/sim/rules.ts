// Game rules: every tunable number for farming, livestock, machines, land and
// progression. Pure data — shared by the client today and the server in Stage 6.
import type { CropType } from '../geometry';
import type { Season, Weather } from '../environment';

/** Simulated Farm Coins per USD of reference price (shop items are priced in $HRV later). */
export const COINS_PER_USD = 100;

export interface CropRule { grow: number; yield: number; seed: number; sell: number; level: number; paddy: boolean }
/** grow = real seconds at 1× conditions; seed/sell in Farm Coins */
export const CROP_RULES: Record<CropType, CropRule> = {
  wheat: { grow: 60, yield: 2, seed: 5, sell: 8, level: 1, paddy: false },
  corn: { grow: 90, yield: 2, seed: 8, sell: 13, level: 1, paddy: false },
  potato: { grow: 75, yield: 3, seed: 12, sell: 10, level: 2, paddy: false },
  soy: { grow: 90, yield: 2, seed: 10, sell: 16, level: 2, paddy: false },
  tomato: { grow: 105, yield: 3, seed: 15, sell: 12, level: 3, paddy: false },
  rice: { grow: 120, yield: 2, seed: 18, sell: 22, level: 3, paddy: true },
  coffee: { grow: 180, yield: 1, seed: 40, sell: 96, level: 5, paddy: false },
  cocoa: { grow: 210, yield: 1, seed: 50, sell: 128, level: 6, paddy: false },
};
/** Growth fraction where each visible stage begins (seeded, sprouting, growing, ready). */
export const STAGE_AT = [0, .25, .55, 1];
/** Watering keeps soil wet for this share of the crop's grow time. */
export const WATER_SHARE = .6;

export const WEATHER_GROWTH: Record<Weather, number> = { sunny: 1, cloudy: .9, rainy: 1, stormy: .7, drought: .6 };
export const SEASON_GROWTH: Record<Season, number> = { spring: 1, summer: 1.1, autumn: .9, winter: .5 };
/** Drought dries soil twice as fast; rain and storms water every field. */
export const DROUGHT_DRYING = 2;

export type AnimalType = 'chicken' | 'sheep' | 'pig' | 'cow';
export interface AnimalRule { cycle: number; product: string; feed: string; feedCycles: number; price: number; pen: string }
export const ANIMAL_RULES: Record<AnimalType, AnimalRule> = {
  chicken: { cycle: 45, product: 'prod-egg', feed: 'feed-chicken', feedCycles: 4, price: 50, pen: 'Chicken coop' },
  sheep: { cycle: 150, product: 'prod-wool', feed: 'feed-sheep', feedCycles: 3, price: 150, pen: 'Sheep pen' },
  pig: { cycle: 120, product: 'prod-truffle', feed: 'feed-pig', feedCycles: 3, price: 200, pen: 'Pig enclosure' },
  cow: { cycle: 90, product: 'prod-milk', feed: 'feed-cattle', feedCycles: 5, price: 300, pen: 'Cow pasture' },
};
export const BASE_CAPACITY: Record<AnimalType, number> = { chicken: 8, sheep: 6, pig: 4, cow: 4 };
/** Extra animal capacity granted by each building bought. */
export const BUILDING_CAPACITY: Record<string, [AnimalType, number] | ['storage', number] | null> = {
  'bld-coop': ['chicken', 8], 'bld-shelter': ['pig', 4], 'bld-barn': ['cow', 6], 'bld-silo': ['storage', 200],
  'bld-greenhouse': null, 'bld-dairy': null,
};
/** Buildings the starting farm already has (one each, can't buy twice). */
export const UNIQUE_BUILDINGS = ['bld-greenhouse', 'bld-dairy'];

export const BASE_STORAGE = 1000;
export const STORAGE_UPGRADE = 300;

export interface MachineRule { maxLevel: number; upgrade: (level: number) => number; describe: (level: number) => string }
export const MACHINE_RULES: Record<string, MachineRule> = {
  'mach-can': { maxLevel: 3, upgrade: l => 200 * l, describe: l => `Holds ${canCapacity(l)} waterings` },
  'mach-pump': { maxLevel: 3, upgrade: l => 400 * l, describe: l => `Auto-waters ${pumpFields(l).length} fields` },
  'mach-tractor': { maxLevel: 5, upgrade: l => 300 * l, describe: l => `Fields grow ${Math.round(tractorBonus(l) * 100)}% faster` },
  'mach-harvester': { maxLevel: 5, upgrade: l => 400 * l, describe: l => `Harvests a whole field, +${l - 1} bonus per field` },
  'mach-planter': { maxLevel: 1, upgrade: () => 0, describe: () => 'Plants a whole field at once' },
  'mach-mill': { maxLevel: 1, upgrade: () => 0, describe: () => '2× flour speed (processing opens in Stage 7)' },
  'mach-storage': { maxLevel: 1, upgrade: () => 0, describe: () => `+${STORAGE_UPGRADE} storage` },
};
export const canCapacity = (level: number) => 10 * level;
export const tractorBonus = (level: number) => .1 + (level - 1) * .05;
/** Plots the irrigation pump keeps wet, by level (paddy first, then the nearest fields). */
export const pumpFields = (level: number) => [24, 20, 21, 14, 15, 8, 9].slice(0, 1 + level * 2);

/** Shop items that change land rather than going into storage. */
export const LAND_ITEMS = ['land-plot', 'land-large', 'land-fertile', 'land-irrigation', 'land-river'];
export const UNAVAILABLE: Record<string, string> = { 'land-river': 'New land opens with farm visits (Stage 10)' };

export const xpForLevel = (level: number) => Math.round(100 * level ** 1.5);
export const XP = { plant: 1, harvest: 3, collect: 2, feed: 1, sell: 0 };

export interface TaskRule { id: string; text: string; stat: string; target: number; coins: number; xp: number }
export const TASKS: TaskRule[] = [
  { id: 't-plant', text: 'Plant 12 crops', stat: 'planted', target: 12, coins: 60, xp: 20 },
  { id: 't-harvest', text: 'Harvest 20 crops', stat: 'harvested', target: 20, coins: 100, xp: 30 },
  { id: 't-water', text: 'Water 6 rows', stat: 'watered', target: 6, coins: 40, xp: 15 },
  { id: 't-collect', text: 'Collect 5 animal products', stat: 'collected', target: 5, coins: 80, xp: 25 },
  { id: 't-feed', text: 'Feed 4 animals', stat: 'fed', target: 4, coins: 40, xp: 15 },
  { id: 't-sell', text: 'Earn 300 coins from sales', stat: 'earned', target: 300, coins: 120, xp: 40 },
];
