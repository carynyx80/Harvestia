// Game clock plus smoothly blended weather values every other system reads.
import {
  DAY_SECONDS, WEATHER_LOOK, isSnowing, lerp, mixRgb, nightness, rgb, skyColor, temperature,
  type EnvSnapshot, type Season, type Weather,
} from '../env/environment';

const WINTER_COOL = rgb('#e6eefc');

export class EnvironmentSystem {
  hour = 7.5;
  day = 12;
  season: Season = 'spring';
  weather: Weather = 'sunny';
  speed = 1;

  // blended toward the active weather so changes fade in and out
  wind = WEATHER_LOOK.sunny.wind;
  rain = 0;
  clouds = WEATHER_LOOK.sunny.clouds;
  cloudAlpha = WEATHER_LOOK.sunny.cloudAlpha;
  dust = 0;
  storm = 0;
  private weatherTint = rgb('#ffffff');

  /** final multiply colour for the lighting overlay */
  tint: [number, number, number] = [255, 255, 255];
  night = 0;

  get snowing() { return isSnowing(this.season, this.weather); }

  update(dt: number) {
    this.hour += dt * this.speed * 24 / DAY_SECONDS;
    if (this.hour >= 24) { this.hour -= 24; this.day++; }
    const look = WEATHER_LOOK[this.weather];
    const k = 1 - Math.exp(-dt * .9);
    this.wind = lerp(this.wind, look.wind, k);
    this.rain = lerp(this.rain, look.rain, k);
    this.clouds = lerp(this.clouds, look.clouds, k);
    this.cloudAlpha = lerp(this.cloudAlpha, look.cloudAlpha, k);
    this.dust = lerp(this.dust, look.dust, k);
    this.storm = lerp(this.storm, look.lightning ? 1 : 0, k);
    // falling snow brightens the scene instead of the grey of rain
    this.weatherTint = mixRgb(this.weatherTint, rgb(this.snowing ? '#e4eaf2' : look.tint), k);

    const sky = skyColor(this.hour);
    const t = this.weatherTint, cool = this.season === 'winter' ? WINTER_COOL : [255, 255, 255];
    this.tint = [0, 1, 2].map(i => sky[i] * t[i] / 255 * cool[i] / 255) as [number, number, number];
    this.night = nightness(this.hour);
  }

  snapshot(): EnvSnapshot {
    return {
      hour: Math.floor(this.hour * 60) / 60, day: this.day, season: this.season, weather: this.weather, speed: this.speed,
      temp: temperature(this.season, this.weather, this.hour), night: Math.round(this.night * 100) / 100,
    };
  }
}
