// Time of day, weather and seasons: the visual rules of the living world.
// Gameplay effects of weather (growth, yield) arrive with core gameplay; this
// module only describes how each condition looks.

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'drought';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const WEATHERS: Weather[] = ['sunny', 'cloudy', 'rainy', 'stormy', 'drought'];
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Real seconds per in-game day at 1× speed. */
export const DAY_SECONDS = 300;

export interface EnvSnapshot { hour: number; day: number; season: Season; weather: Weather; speed: number; temp: number; night: number }

export interface WeatherLook {
  tint: string;        // multiplied over the scene on top of the sky colour
  clouds: number;      // cloud-shadow count
  cloudAlpha: number;
  rain: number;        // drops alive at once across the view
  wind: number;        // sway strength and rain slant
  lightning: boolean;
  dust: number;        // drifting dust motes (drought)
}
export const WEATHER_LOOK: Record<Weather, WeatherLook> = {
  sunny: { tint: '#ffffff', clouds: 3, cloudAlpha: .08, rain: 0, wind: .6, lightning: false, dust: 0 },
  cloudy: { tint: '#dde2ea', clouds: 9, cloudAlpha: .13, rain: 0, wind: .9, lightning: false, dust: 0 },
  rainy: { tint: '#bcc4d0', clouds: 12, cloudAlpha: .16, rain: 420, wind: 1.1, lightning: false, dust: 0 },
  stormy: { tint: '#8e98ae', clouds: 14, cloudAlpha: .2, rain: 900, wind: 2.2, lightning: true, dust: 0 },
  drought: { tint: '#fff0c8', clouds: 0, cloudAlpha: 0, rain: 0, wind: .4, lightning: false, dust: 70 },
};
export const WEATHER_LABEL: Record<Weather, string> = { sunny: 'Sunny', cloudy: 'Cloudy', rainy: 'Rain', stormy: 'Storm', drought: 'Drought' };

// Sky colour over the day, multiplied over the world.
const SKY: [number, string][] = [
  [0, '#36448a'], [4.5, '#36448a'], [5.5, '#76609a'], [6.5, '#eca88c'], [7.5, '#ffe4cc'], [9, '#ffffff'],
  [16.5, '#ffffff'], [18, '#ffd9aa'], [19, '#ee9a78'], [20, '#86689a'], [21, '#44528e'], [24, '#36448a'],
];
// How "night" it is: drives window lights, lamps and fireflies.
const NIGHT: [number, number][] = [[0, 1], [5, 1], [6.6, 0], [18.4, 0], [20.4, 1], [24, 1]];

export const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as [number, number, number];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixRgb = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as [number, number, number];

function track<T>(keys: [number, T][], h: number, mix: (a: T, b: T, t: number) => T): T {
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, v0] = keys[i], [h1, v1] = keys[i + 1];
    if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0 || 1); return mix(v0, v1, t * t * (3 - 2 * t)); }
  }
  return keys[keys.length - 1][1];
}
export const skyColor = (hour: number) => track(SKY.map(([h, c]) => [h, rgb(c)] as [number, [number, number, number]]), ((hour % 24) + 24) % 24, mixRgb);
export const nightness = (hour: number) => track(NIGHT, ((hour % 24) + 24) % 24, lerp);

const BASE_TEMP: Record<Season, number> = { spring: 16, summer: 27, autumn: 13, winter: -2 };
const WEATHER_TEMP: Record<Weather, number> = { sunny: 2, cloudy: -1, rainy: -3, stormy: -4, drought: 8 };
export const temperature = (season: Season, weather: Weather, hour: number) =>
  Math.round(BASE_TEMP[season] + WEATHER_TEMP[weather] + 5 * Math.sin(((hour - 9) / 24) * Math.PI * 2));

export const formatHour = (hour: number) => {
  const h = Math.floor(((hour % 24) + 24) % 24), m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** In winter, rain and storms fall as snow. */
export const isSnowing = (season: Season, weather: Weather) => season === 'winter' && (weather === 'rainy' || weather === 'stormy' || weather === 'cloudy');
