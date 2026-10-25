// Seasonal recolouring of nature: grass, trees, bushes, reeds and ground cover.
// Buildings, characters and crops keep their approved colours all year.
import type { Season } from './environment';

type Swap = Record<string, string>;
const zip = (from: string[], to: string[]): Swap => Object.fromEntries(from.map((c, i) => [c, to[i]]));

// Source ramps exactly as the sprite library and terrain use them.
const GRASS = ['#44943d', '#4ea243', '#59b049', '#66bd50', '#76c958'];
const GRASS_SPECK = ['#86d466', '#3d8a3a', '#357633'];
const CANOPY = ['#2a6430', '#3b893b', '#52a645', '#6cbf52', '#8edb6c'];
const PINE = ['#1a4430', '#1d4f35', '#2d7046', '#3f8a55', '#4f9e5e'];
const TUFT = ['#7fcf5c', '#357a34'];
const REEDS = ['#5fae3f', '#4f8a3c'];
const SAND = ['#dcc78f', '#cbb57a', '#b8a46c'];

const AUTUMN_CANOPY = [
  ['#8a3a1a', '#c0581e', '#e07a2a', '#f09a3a', '#f8c060'],
  ['#6e1c1c', '#a03026', '#c8462f', '#e06a3e', '#f09060'],
  ['#7a5e18', '#a8841c', '#d0a82c', '#e8c446', '#f8e07a'],
  ['#3a5a2a', '#5a7a34', '#7a9a3e', '#9ab04a', '#c0c86a'],
];

const SEASON: Record<Season, Swap> = {
  spring: {},
  summer: {
    ...zip(GRASS, ['#4a983a', '#56a33d', '#63ae43', '#72ba49', '#84c652']),
    ...zip(GRASS_SPECK, ['#98d460', '#3f8a36', '#3a7a30']),
    ...zip(CANOPY, ['#24592a', '#357d34', '#4c9a3e', '#66b44a', '#8ccf5e']),
    ...zip(TUFT, ['#8ccf5a', '#3a7a30']),
  },
  autumn: {
    ...zip(GRASS, ['#7d8a3c', '#8c9641', '#9ba147', '#a9aa50', '#b9b35a']),
    ...zip(GRASS_SPECK, ['#d8c066', '#6e7a34', '#5f6a2e']),
    ...zip(PINE, ['#1c3e2c', '#214834', '#2e6444', '#4a7c4e', '#5a8a52']),
    ...zip(TUFT, ['#c9b25a', '#7a6a2a']),
    ...zip(REEDS, ['#b89a4a', '#8a7a3a']),
  },
  winter: {
    ...zip(GRASS, ['#d6e2ea', '#dfe9f0', '#e8f0f5', '#f0f6f9', '#f8fbfd']),
    ...zip(GRASS_SPECK, ['#ffffff', '#b8c8d6', '#a8b8c6']),
    ...zip(CANOPY, ['#5a4636', '#86857f', '#c8d4dc', '#e8f0f4', '#ffffff']),
    ...zip(PINE, ['#163a2c', '#1c4434', '#285c42', '#dfe9f0', '#f8fbfd']),
    ...zip(TUFT, ['#e6eef2', '#9aaab6']),
    ...zip(REEDS, ['#c8b48a', '#9a8a6a']),
    ...zip(SAND, ['#e4e2da', '#d4d2ca', '#b4b4ae']),
  },
};

// Drought parches grass and ground cover (no effect under winter snow).
const DRY: Swap = {
  ...zip(GRASS, ['#8a9440', '#97a046', '#a5a94e', '#b2b158', '#c0ba63']),
  ...zip(GRASS_SPECK, ['#d4c472', '#7a7a38', '#6a6a30']),
  ...zip(TUFT, ['#c4b460', '#7a7230']),
};

/**
 * Colour swap for a season. `variant` picks one of several autumn leaf colours per
 * tree; `dry` applies the drought look on top.
 */
export function seasonSwap(season: Season, variant = 0, dry = false): (c: string) => string {
  const base = SEASON[season];
  const leaves = season === 'autumn' ? zip(CANOPY, AUTUMN_CANOPY[variant % AUTUMN_CANOPY.length]) : null;
  const parched = dry && season !== 'winter' ? DRY : null;
  if (!leaves && !parched && season === 'spring') return c => c;
  return c => parched?.[c] ?? leaves?.[c] ?? base[c] ?? c;
}
