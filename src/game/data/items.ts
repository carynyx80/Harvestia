// Item catalog: everything that can sit in storage or be bought in the shop.
// usd is the reference price shown beside the $HRV amount (always ≤ $15).
import HV from '../art/sprites';
import { ItemArt } from '../art/itemArt';
import { CROP_NAMES, type CropType } from '../world/geometry';

export type ShopCategory = 'seeds' | 'feed' | 'livestock' | 'buildings' | 'land' | 'machinery';
export type ItemCategory = ShopCategory | 'crops' | 'products' | 'goods';

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  desc: string;
  /** reference price in USD (shop items) or indicative sale value (produce) */
  usd: number;
  /** draws the icon at the origin; `thumb` icons are full world sprites shown larger */
  art: () => void;
  thumb?: boolean;
  effect?: string;
}

const CROPS: [CropType, number, number, string][] = [
  // crop, seed price, growth hours (game time), note
  ['wheat', .05, 4, 'Quick, hardy staple. Mills into flour.'],
  ['corn', .08, 6, 'Tall stalks, big yields. Mills into meal.'],
  ['soy', .10, 6, 'Soybeans fix nitrogen and sell steadily.'],
  ['potato', .12, 5, 'Grows underground; shrugs off light frost.'],
  ['tomato', .15, 7, 'Needs regular water. Processes into sauce.'],
  ['rice', .18, 8, 'Paddy only — needs the irrigation pump.'],
  ['coffee', .40, 14, 'Slow shrub, valuable cherries. Prefers shade.'],
  ['cocoa', .50, 16, 'Slow tree crop. Processes into chocolate.'],
];

export const ITEMS: Item[] = [
  ...CROPS.map(([c, usd, hours, note]): Item => ({ id: `seed-${c}`, name: `${CROP_NAMES[c]} seeds`, category: 'seeds', usd, art: ItemArt.seeds(c), desc: `${note} Ready in about ${hours} game-hours.` })),
  ...CROPS.map(([c, usd]): Item => ({ id: `crop-${c}`, name: CROP_NAMES[c], category: 'crops', usd: +(usd * 1.6).toFixed(2), art: ItemArt.crop(c), desc: `Harvested ${CROP_NAMES[c].toLowerCase()}. Store it, process it or sell it at the exchange.` })),

  { id: 'feed-chicken', name: 'Chicken feed', category: 'feed', usd: .10, art: ItemArt.feed('#e8b93c'), desc: 'Grain mix. One bag feeds the coop for a day.' },
  { id: 'feed-sheep', name: 'Sheep feed', category: 'feed', usd: .25, art: ItemArt.feed('#7fcf5c'), desc: 'Hay pellets for a healthy fleece.' },
  { id: 'feed-pig', name: 'Pig feed', category: 'feed', usd: .35, art: ItemArt.feed('#c48d52'), desc: 'Mash that keeps pigs happy.' },
  { id: 'feed-cattle', name: 'Cattle feed', category: 'feed', usd: .75, art: ItemArt.feed('#3f6fa8'), desc: 'Rich silage; raises milk output.' },

  { id: 'animal-chicken', name: 'Chicken', category: 'livestock', usd: .50, thumb: true, art: () => HV.chicken(0, 0, 0), desc: 'Lays eggs on a short cycle.', effect: 'Eggs every 6 game-hours' },
  { id: 'animal-sheep', name: 'Sheep', category: 'livestock', usd: 1.50, thumb: true, art: () => HV.sheep(0, 0, 0), desc: 'Grows wool between shearings.', effect: 'Wool every 24 game-hours' },
  { id: 'animal-pig', name: 'Pig', category: 'livestock', usd: 2.00, thumb: true, art: () => HV.pig(0, 0, 0), desc: 'Sniffs out truffles when well fed.', effect: 'Truffles every 18 game-hours' },
  { id: 'animal-cow', name: 'Cow', category: 'livestock', usd: 3.00, thumb: true, art: () => HV.cow(0, 0, 0), desc: 'Gives milk daily; needs the barn.', effect: 'Milk every 12 game-hours' },

  { id: 'bld-coop', name: 'Chicken coop', category: 'buildings', usd: 1.00, thumb: true, art: () => HV.coop(0, 0), desc: 'Houses up to 8 chickens.', effect: '+8 chicken capacity' },
  { id: 'bld-shelter', name: 'Pig shelter', category: 'buildings', usd: 1.50, thumb: true, art: () => HV.shelter(0, 0), desc: 'Shade and straw for 4 pigs.', effect: '+4 pig capacity' },
  { id: 'bld-silo', name: 'Grain silo', category: 'buildings', usd: 3.00, thumb: true, art: () => HV.silo(0, 0), desc: 'Bulk crop storage.', effect: '+200 crop storage' },
  { id: 'bld-greenhouse', name: 'Greenhouse', category: 'buildings', usd: 4.00, thumb: true, art: () => HV.greenhouse(0, 0), desc: 'Weather-proof growing.', effect: 'Ignores drought and storms' },
  { id: 'bld-barn', name: 'Cow barn', category: 'buildings', usd: 6.00, thumb: true, art: () => HV.barn(0, 0), desc: 'Shelter for 6 cows.', effect: '+6 cow capacity' },
  { id: 'bld-dairy', name: 'Dairy', category: 'buildings', usd: 7.00, thumb: true, art: () => HV.dairy(0, 0), desc: 'Turns milk into cheese and butter.', effect: 'Unlocks dairy recipes' },

  { id: 'land-plot', name: 'Expansion plot', category: 'land', usd: 2.00, art: () => { HV.R(1, 3, 14, 11, '#7a4a2a'); for (let y = 5; y < 13; y += 3) HV.R(2, y, 12, 1, '#5a3420'); HV.sign(8, 14, '#e8c35a'); }, desc: 'Unlocks one 60×44 field.', effect: '+1 field' },
  { id: 'land-irrigation', name: 'Irrigation channel', category: 'land', usd: 3.00, art: () => { HV.R(1, 4, 14, 9, '#59b049'); HV.R(1, 7, 14, 3, '#3d8fd6'); HV.R(1, 7, 14, 1, '#86ccf2'); }, desc: 'Keeps neighbouring fields watered.', effect: 'Auto-water 2 fields' },
  { id: 'land-fertile', name: 'Fertile soil', category: 'land', usd: 4.00, art: () => { HV.R(1, 3, 14, 11, '#5a3420'); for (let i = 0; i < 10; i++) HV.P(2 + (i * 7) % 12, 4 + (i * 5) % 9, '#9c6a3e'); HV.crop('wheat', 2, 8, 12); }, desc: 'Richer soil for one field.', effect: '+10% yield on one field' },
  { id: 'land-large', name: 'Large expansion', category: 'land', usd: 5.00, art: () => { HV.R(0, 2, 16, 12, '#7a4a2a'); for (let y = 4; y < 13; y += 3) HV.R(1, y, 14, 1, '#5a3420'); HV.R(7, 2, 2, 12, '#c99a60'); }, desc: 'Unlocks two adjoining fields.', effect: '+2 fields' },
  { id: 'land-river', name: 'Riverside acre', category: 'land', usd: 10.00, art: () => { HV.R(0, 2, 16, 12, '#59b049'); HV.R(10, 2, 6, 12, '#3d8fd6'); HV.R(10, 2, 1, 12, '#dcc78f'); HV.tree(5, 12, 3, 4); }, desc: 'Premium land by the river.', effect: '+3 fields, free irrigation' },

  { id: 'mach-can', name: 'Copper watering can', category: 'machinery', usd: 3.00, art: ItemArt.can, desc: 'Holds twice the water.', effect: '20 waterings per refill' },
  { id: 'mach-storage', name: 'Storage upgrade', category: 'machinery', usd: 5.00, thumb: true, art: () => HV.crate(0, 0, '#f2c94c'), desc: 'Shelving for the warehouse.', effect: '+60 inventory slots' },
  { id: 'mach-pump', name: 'Irrigation pump', category: 'machinery', usd: 6.00, thumb: true, art: () => HV.pump(0, 0), desc: 'Waters connected fields automatically.', effect: 'Auto-water 4 fields' },
  { id: 'mach-planter', name: 'Seed planter', category: 'machinery', usd: 8.00, art: () => { HV.R(2, 6, 12, 6, '#5ea9d1'); HV.R(2, 6, 12, 1, '#8fd0ee'); HV.R(1, 12, 14, 2, '#3a3a3a'); HV.E(4, 13, 2, 2, '#232323'); HV.E(12, 13, 2, 2, '#232323'); HV.R(4, 3, 8, 3, '#e8b93c'); }, desc: 'Plants a whole row at once.', effect: 'Plant 6 cells per action' },
  { id: 'mach-mill', name: 'Millstones', category: 'machinery', usd: 9.00, art: () => { HV.E(8, 10, 6, 4, '#9b9384'); HV.E(8, 8, 6, 4, '#b8b0a0'); HV.E(8, 8, 1, 1, '#5a3a26'); HV.R(6, 13, 4, 2, '#e9e0c8'); }, desc: 'Processing equipment for the mill.', effect: '2× flour speed' },
  { id: 'mach-tractor', name: 'Small tractor', category: 'machinery', usd: 12.00, thumb: true, art: () => HV.tractor(0, 0, 0), desc: 'Tills and plants fields fast.', effect: 'Plant a field per action' },
  { id: 'mach-harvester', name: 'Combine harvester', category: 'machinery', usd: 15.00, thumb: true, art: () => HV.harvester(0, 0, 0), desc: 'Harvests a whole field in one pass.', effect: 'Harvest a field per action' },

  { id: 'prod-egg', name: 'Eggs', category: 'products', usd: .08, art: ItemArt.egg, desc: 'Fresh from the coop.' },
  { id: 'prod-milk', name: 'Milk', category: 'products', usd: .20, art: ItemArt.milk, desc: 'Process into cheese or butter at the dairy.' },
  { id: 'prod-wool', name: 'Wool', category: 'products', usd: .30, art: ItemArt.wool, desc: 'Soft fleece from the sheep pen.' },
  { id: 'prod-truffle', name: 'Truffles', category: 'products', usd: .60, art: ItemArt.truffle, desc: 'Found by happy pigs.' },

  { id: 'good-flour', name: 'Flour', category: 'goods', usd: .18, art: ItemArt.flour, desc: 'Milled wheat.' },
  { id: 'good-cheese', name: 'Cheese', category: 'goods', usd: .55, art: ItemArt.cheese, desc: 'Aged at the dairy.' },
  { id: 'good-butter', name: 'Butter', category: 'goods', usd: .40, art: ItemArt.butter, desc: 'Churned at the dairy.' },
  { id: 'good-chocolate', name: 'Chocolate', category: 'goods', usd: 1.20, art: ItemArt.chocolate, desc: 'Made from cocoa at food processing.' },
  { id: 'good-coffee', name: 'Roasted coffee', category: 'goods', usd: .90, art: ItemArt.coffeeBag, desc: 'Roasted beans in a jute bag.' },
  { id: 'good-sauce', name: 'Tomato sauce', category: 'goods', usd: .35, art: ItemArt.sauce, desc: 'Jarred at food processing.' },
];

export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i])) as Record<string, Item>;

export const SHOP_TABS: { key: ShopCategory; label: string; range: string }[] = [
  { key: 'seeds', label: 'Seeds', range: '$0.05–$0.50' }, { key: 'feed', label: 'Feed', range: '$0.10–$0.75' },
  { key: 'livestock', label: 'Livestock', range: '$0.50–$3' }, { key: 'buildings', label: 'Buildings', range: '$1–$7' },
  { key: 'land', label: 'Land', range: '$2–$10' }, { key: 'machinery', label: 'Machinery', range: '$3–$15' },
];
