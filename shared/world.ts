// The shared world clock: time of day, day number, season and weather are a
// pure function of real time, so every client and the server agree without
// talking to each other. The server's clock is the authority for game rules.
import { hash } from './hash';
import { DAY_SECONDS, SEASONS, type Season, type Weather } from './environment';

/** When day 1 began. */
export const WORLD_EPOCH = Date.UTC(2026, 9, 1);
/** In-game days per season. */
export const SEASON_DAYS = 7;
/** Weather changes every half day. */
const WEATHER_BLOCKS_PER_DAY = 2;

const CHANCES: Record<Season, [Weather, number][]> = {
  spring: [['sunny', .4], ['cloudy', .25], ['rainy', .25], ['stormy', .05], ['drought', .05]],
  summer: [['sunny', .5], ['cloudy', .15], ['rainy', .1], ['stormy', .1], ['drought', .15]],
  autumn: [['sunny', .3], ['cloudy', .3], ['rainy', .25], ['stormy', .1], ['drought', .05]],
  winter: [['sunny', .35], ['cloudy', .35], ['rainy', .2], ['stormy', .1], ['drought', 0]],
};

/** day counts from the epoch; seasonDay (1–7) and year are what players see. */
export interface WorldState { day: number; seasonDay: number; year: number; hour: number; season: Season; weather: Weather }

export function worldAt(ms: number): WorldState {
  const days = (ms - WORLD_EPOCH) / 1000 / DAY_SECONDS;
  const dayIndex = Math.floor(days);
  const season = SEASONS[((Math.floor(dayIndex / SEASON_DAYS) % 4) + 4) % 4];
  const block = Math.floor(days * WEATHER_BLOCKS_PER_DAY);
  let r = hash(block, 7, 91), weather: Weather = 'sunny';
  for (const [w, p] of CHANCES[season]) { if (r < p) { weather = w; break; } r -= p; }
  const seasonDay = (((dayIndex % SEASON_DAYS) + SEASON_DAYS) % SEASON_DAYS) + 1;
  const year = Math.floor(dayIndex / (SEASON_DAYS * 4)) + 1;
  return { day: dayIndex + 1, seasonDay, year, hour: (days - dayIndex) * 24, season, weather };
}
