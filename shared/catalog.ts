// Item catalog data shared by the client and the server. usd is the reference
// price (shop items ≤ $15) or indicative sale value for produce. Icons live in
// the client (src/game/data/items.ts).
import { CROP_NAMES, type CropType } from './geometry';

export type ShopCategory = 'seeds' | 'feed' | 'livestock' | 'buildings' | 'land' | 'machinery';
export type ItemCategory = ShopCategory | 'crops' | 'products' | 'goods';

export interface CatalogItem {
  id: string;
  name: string;
  category: ItemCategory;
  desc: string;
  usd: number;
  effect?: string;
  /** shown with its full world sprite rather than a 16×16 icon */
  thumb?: boolean;
}

export const CROP_INFO: [CropType, number, number, string][] = [
  // crop, seed price (USD), growth (game-hours, descriptive), note
  ['wheat', .05, 4, 'Quick, hardy staple. Mills into flour.'],
  ['corn', .08, 6, 'Tall stalks, big yields. Mills into meal.'],
  ['soy', .10, 6, 'Soybeans fix nitrogen and sell steadily.'],
  ['potato', .12, 5, 'Grows underground; shrugs off light frost.'],
  ['tomato', .15, 7, 'Needs regular water. Processes into sauce.'],
  ['rice', .18, 8, 'Paddy only — needs the irrigation pump.'],
  ['coffee', .40, 14, 'Slow shrub, valuable cherries. Prefers shade.'],
  ['cocoa', .50, 16, 'Slow tree crop. Processes into chocolate.'],
];

export const CATALOG: CatalogItem[] = [
  ...CROP_INFO.map(([c, usd, hours, note]): CatalogItem => ({ id: `seed-${c}`, name: `${CROP_NAMES[c]} seeds`, category: 'seeds', usd, desc: `${note} Ready in about ${hours} game-hours.` })),
  ...CROP_INFO.map(([c, usd]): CatalogItem => ({ id: `crop-${c}`, name: CROP_NAMES[c], category: 'crops', usd: +(usd * 1.6).toFixed(2), desc: `Harvested ${CROP_NAMES[c].toLowerCase()}. Store it, process it or trade it at the commodity exchange.` })),

  { id: 'feed-chicken', name: 'Chicken feed', category: 'feed', usd: .10, desc: 'Grain mix. One bag feeds a hen for several laying cycles.' },
  { id: 'feed-sheep', name: 'Sheep feed', category: 'feed', usd: .25, desc: 'Hay pellets for a healthy fleece.' },
  { id: 'feed-pig', name: 'Pig feed', category: 'feed', usd: .35, desc: 'Mash that keeps pigs happy.' },
  { id: 'feed-cattle', name: 'Cattle feed', category: 'feed', usd: .75, desc: 'Rich silage; raises milk output.' },

  { id: 'animal-chicken', name: 'Chicken', category: 'livestock', usd: .50, thumb: true, desc: 'Lays eggs on a short cycle.', effect: 'Eggs every 45 seconds while fed' },
  { id: 'animal-sheep', name: 'Sheep', category: 'livestock', usd: 1.50, thumb: true, desc: 'Grows wool between shearings.', effect: 'Wool every 2½ minutes while fed' },
  { id: 'animal-pig', name: 'Pig', category: 'livestock', usd: 2.00, thumb: true, desc: 'Sniffs out truffles when well fed.', effect: 'Truffles every 2 minutes while fed' },
  { id: 'animal-cow', name: 'Cow', category: 'livestock', usd: 3.00, thumb: true, desc: 'Gives milk; needs space in the pasture.', effect: 'Milk every 1½ minutes while fed' },

  { id: 'bld-coop', name: 'Chicken coop', category: 'buildings', usd: 1.00, thumb: true, desc: 'Houses up to 8 more chickens.', effect: '+8 chicken capacity' },
  { id: 'bld-shelter', name: 'Pig shelter', category: 'buildings', usd: 1.50, thumb: true, desc: 'Shade and straw for 4 more pigs.', effect: '+4 pig capacity' },
  { id: 'bld-silo', name: 'Grain silo', category: 'buildings', usd: 3.00, thumb: true, desc: 'Bulk crop storage.', effect: '+200 storage' },
  { id: 'bld-greenhouse', name: 'Greenhouse', category: 'buildings', usd: 4.00, thumb: true, desc: 'Weather-proof growing.', effect: 'Ignores drought and storms' },
  { id: 'bld-barn', name: 'Cow barn', category: 'buildings', usd: 6.00, thumb: true, desc: 'Shelter for 6 more cows.', effect: '+6 cow capacity' },
  { id: 'bld-cold', name: 'Cold storage', category: 'buildings', usd: 5.00, desc: 'Refrigerated room in the produce warehouse.', effect: 'Eggs, milk and tomatoes stop spoiling' },
  { id: 'bld-dairy', name: 'Dairy', category: 'buildings', usd: 7.00, thumb: true, desc: 'Turns milk into cheese and butter.', effect: 'Unlocks dairy recipes' },

  { id: 'land-plot', name: 'Expansion plot', category: 'land', usd: 2.00, desc: 'Unlocks one 60×44 field.', effect: '+1 field' },
  { id: 'land-irrigation', name: 'Irrigation channel', category: 'land', usd: 3.00, desc: 'Keeps one field permanently watered.', effect: 'Auto-water a field' },
  { id: 'land-fertile', name: 'Fertile soil', category: 'land', usd: 4.00, desc: 'Richer soil for one field.', effect: '+1 crop per plant on one field' },
  { id: 'land-large', name: 'Large expansion', category: 'land', usd: 5.00, desc: 'Unlocks two adjoining fields.', effect: '+2 fields' },
  { id: 'land-river', name: 'Riverside acre', category: 'land', usd: 10.00, desc: 'Premium land by the river.', effect: '+3 fields, free irrigation' },

  { id: 'mach-can', name: 'Copper watering can', category: 'machinery', usd: 3.00, desc: 'Holds twice the water.', effect: '20 waterings per refill' },
  { id: 'mach-storage', name: 'Storage upgrade', category: 'machinery', usd: 5.00, thumb: true, desc: 'Shelving for the warehouse.', effect: '+300 storage' },
  { id: 'mach-pump', name: 'Irrigation pump', category: 'machinery', usd: 6.00, thumb: true, desc: 'Waters connected fields automatically.', effect: 'Auto-water nearby fields' },
  { id: 'mach-planter', name: 'Seed planter', category: 'machinery', usd: 8.00, desc: 'Plants a whole field at once.', effect: 'Plant a field per click' },
  { id: 'mach-mill', name: 'Millstones', category: 'machinery', usd: 9.00, desc: 'Processing equipment for the mill.', effect: '2× flour speed' },
  { id: 'mach-tractor', name: 'Small tractor', category: 'machinery', usd: 12.00, thumb: true, desc: 'Tills fields so crops grow faster.', effect: 'Crops grow 10%+ faster' },
  { id: 'mach-harvester', name: 'Combine harvester', category: 'machinery', usd: 15.00, thumb: true, desc: 'Harvests a whole field in one pass.', effect: 'Harvest a field per click' },

  { id: 'prod-egg', name: 'Eggs', category: 'products', usd: .08, desc: 'Fresh from the coop.' },
  { id: 'prod-milk', name: 'Milk', category: 'products', usd: .20, desc: 'Process into cheese or butter at the dairy.' },
  { id: 'prod-wool', name: 'Wool', category: 'products', usd: .30, desc: 'Soft fleece from the sheep pen.' },
  { id: 'prod-truffle', name: 'Truffles', category: 'products', usd: .60, desc: 'Found by happy pigs.' },

  { id: 'good-flour', name: 'Flour', category: 'goods', usd: .18, desc: 'Milled wheat.' },
  { id: 'good-cornmeal', name: 'Cornmeal', category: 'goods', usd: .26, desc: 'Stone-ground corn from the mill.' },
  { id: 'good-soyoil', name: 'Soybean oil', category: 'goods', usd: .65, desc: 'Pressed at food processing.' },
  { id: 'good-cheese', name: 'Cheese', category: 'goods', usd: .55, desc: 'Aged at the dairy.' },
  { id: 'good-butter', name: 'Butter', category: 'goods', usd: .50, desc: 'Churned at the dairy.' },
  { id: 'good-chocolate', name: 'Chocolate', category: 'goods', usd: 1.20, desc: 'Made from cocoa at food processing.' },
  { id: 'good-coffee', name: 'Roasted coffee', category: 'goods', usd: .90, desc: 'Roasted beans in a jute bag.' },
  { id: 'good-sauce', name: 'Tomato sauce', category: 'goods', usd: .65, desc: 'Jarred at food processing.' },
];

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map(i => [i.id, i]));

export const SHOP_TABS: { key: ShopCategory; label: string; range: string }[] = [
  { key: 'seeds', label: 'Seeds', range: '$0.05–$0.50' }, { key: 'feed', label: 'Feed', range: '$0.10–$0.75' },
  { key: 'livestock', label: 'Livestock', range: '$0.50–$3' }, { key: 'buildings', label: 'Buildings', range: '$1–$7' },
  { key: 'land', label: 'Land', range: '$2–$10' }, { key: 'machinery', label: 'Machinery', range: '$3–$15' },
];
