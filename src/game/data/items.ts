// Client item catalog: the shared catalog data plus each item's icon art.
import HV from '../art/sprites';
import { ItemArt } from '../art/itemArt';
import { CATALOG, CROP_INFO, type CatalogItem } from '../../../shared/catalog';

export { SHOP_TABS, type ItemCategory, type ShopCategory } from '../../../shared/catalog';

export interface Item extends CatalogItem {
  /** draws the icon at the origin; `thumb` icons are full world sprites shown larger */
  art: () => void;
}

const ART: Record<string, () => void> = {
  ...Object.fromEntries(CROP_INFO.flatMap(([c]) => [[`seed-${c}`, ItemArt.seeds(c)], [`crop-${c}`, ItemArt.crop(c)]])),
  'feed-chicken': ItemArt.feed('#e8b93c'), 'feed-sheep': ItemArt.feed('#7fcf5c'), 'feed-pig': ItemArt.feed('#c48d52'), 'feed-cattle': ItemArt.feed('#3f6fa8'),
  'animal-chicken': () => HV.chicken(0, 0, 0), 'animal-sheep': () => HV.sheep(0, 0, 0), 'animal-pig': () => HV.pig(0, 0, 0), 'animal-cow': () => HV.cow(0, 0, 0),
  'bld-coop': () => HV.coop(0, 0), 'bld-shelter': () => HV.shelter(0, 0), 'bld-silo': () => HV.silo(0, 0), 'bld-greenhouse': () => HV.greenhouse(0, 0),
  'bld-barn': () => HV.barn(0, 0), 'bld-dairy': () => HV.dairy(0, 0),
  'bld-cold': () => { HV.R(1, 3, 14, 12, '#dfe9f0'); HV.R(1, 3, 14, 2, '#9fb7c8'); HV.R(5, 7, 6, 8, '#9fb7c8'); HV.R(6, 8, 4, 7, '#c9dbe6'); HV.P(9, 11, '#5e6670'); HV.R(2, 6, 2, 2, '#86ccf2'); HV.R(12, 6, 2, 2, '#86ccf2'); },
  'land-plot': () => { HV.R(1, 3, 14, 11, '#7a4a2a'); for (let y = 5; y < 13; y += 3) HV.R(2, y, 12, 1, '#5a3420'); HV.sign(8, 14, '#e8c35a'); },
  'land-irrigation': () => { HV.R(1, 4, 14, 9, '#59b049'); HV.R(1, 7, 14, 3, '#3d8fd6'); HV.R(1, 7, 14, 1, '#86ccf2'); },
  'land-fertile': () => { HV.R(1, 3, 14, 11, '#5a3420'); for (let i = 0; i < 10; i++) HV.P(2 + (i * 7) % 12, 4 + (i * 5) % 9, '#9c6a3e'); HV.crop('wheat', 2, 8, 12); },
  'land-large': () => { HV.R(0, 2, 16, 12, '#7a4a2a'); for (let y = 4; y < 13; y += 3) HV.R(1, y, 14, 1, '#5a3420'); HV.R(7, 2, 2, 12, '#c99a60'); },
  'land-river': () => { HV.R(0, 2, 16, 12, '#59b049'); HV.R(10, 2, 6, 12, '#3d8fd6'); HV.R(10, 2, 1, 12, '#dcc78f'); HV.tree(5, 12, 3, 4); },
  'mach-can': ItemArt.can, 'mach-storage': () => HV.crate(0, 0, '#f2c94c'), 'mach-pump': () => HV.pump(0, 0),
  'mach-planter': () => { HV.R(2, 6, 12, 6, '#5ea9d1'); HV.R(2, 6, 12, 1, '#8fd0ee'); HV.R(1, 12, 14, 2, '#3a3a3a'); HV.E(4, 13, 2, 2, '#232323'); HV.E(12, 13, 2, 2, '#232323'); HV.R(4, 3, 8, 3, '#e8b93c'); },
  'mach-mill': () => { HV.E(8, 10, 6, 4, '#9b9384'); HV.E(8, 8, 6, 4, '#b8b0a0'); HV.E(8, 8, 1, 1, '#5a3a26'); HV.R(6, 13, 4, 2, '#e9e0c8'); },
  'mach-tractor': () => HV.tractor(0, 0, 0), 'mach-harvester': () => HV.harvester(0, 0, 0),
  'prod-egg': ItemArt.egg, 'prod-milk': ItemArt.milk, 'prod-wool': ItemArt.wool, 'prod-truffle': ItemArt.truffle,
  'good-flour': ItemArt.flour, 'good-cheese': ItemArt.cheese, 'good-butter': ItemArt.butter, 'good-chocolate': ItemArt.chocolate,
  'good-coffee': ItemArt.coffeeBag, 'good-sauce': ItemArt.sauce,
  'good-cornmeal': () => { HV.sack(8, 15); HV.R(6, 10, 4, 2, '#f2c94c'); HV.P(7, 7, '#e8b93c'); HV.P(9, 8, '#e8b93c'); },
  'good-soyoil': () => { HV.E(8, 15, 4, 1, 'rgba(22,46,18,.3)'); HV.R(5, 5, 6, 10, '#e8c35a'); HV.R(6, 3, 4, 2, '#d9cfa8'); HV.R(7, 2, 2, 1, '#3f8f3a'); HV.R(5, 5, 1, 10, '#fff0a8'); HV.R(6, 9, 4, 3, '#f4e4bc'); HV.P(7, 10, '#7cc24c'); },
};

export const ITEMS: Item[] = CATALOG.map(c => ({ ...c, art: ART[c.id] ?? (() => HV.crate(4, 4)) }));
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i])) as Record<string, Item>;
