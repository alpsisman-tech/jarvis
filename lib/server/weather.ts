import type { WeatherBundle } from "../types";

// Open-Meteo — free, no API key.
export async function fetchWeather(lat: number, lon: number, place: string): Promise<WeatherBundle> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max,sunrise,sunset` +
    `&timezone=auto&forecast_days=6`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = await res.json();

  const nowIdx = Math.max(0, j.hourly.time.findIndex((t: string) => t >= j.current.time));
  const hourly = j.hourly.time.slice(nowIdx, nowIdx + 24).map((t: string, i: number) => ({
    time: t,
    temp_c: j.hourly.temperature_2m[nowIdx + i],
    code: j.hourly.weather_code[nowIdx + i],
    precip_prob: j.hourly.precipitation_probability[nowIdx + i] ?? 0,
  }));

  const daily = j.daily.time.map((d: string, i: number) => ({
    date: d,
    min_c: j.daily.temperature_2m_min[i],
    max_c: j.daily.temperature_2m_max[i],
    code: j.daily.weather_code[i],
    precip_prob: j.daily.precipitation_probability_max[i] ?? 0,
    sunrise: j.daily.sunrise[i],
    sunset: j.daily.sunset[i],
  }));

  const temp = j.current.temperature_2m;
  const wind = j.current.wind_speed_10m;
  const code = j.current.weather_code;
  const rainSoon = hourly.slice(0, 4).some((h: { precip_prob: number }) => h.precip_prob > 45);
  let advice: string;
  if (code >= 95) advice = "Thunderstorms — take it indoors today.";
  else if (rainSoon) advice = "Rain likely in the next few hours — run early or plan a treadmill session.";
  else if (temp >= 28) advice = "Hot out — run early/late, shorten intervals and hydrate extra.";
  else if (temp <= 2) advice = "Cold — warm up indoors first and layer up.";
  else if (wind >= 30) advice = "Very windy — do loops or an out-and-back starting into the wind.";
  else advice = "Good conditions for an outdoor run.";

  return {
    place,
    now: {
      temp_c: temp, feels_c: j.current.apparent_temperature, code,
      wind_kmh: wind, humidity: j.current.relative_humidity_2m, is_day: j.current.is_day === 1,
    },
    hourly, daily, run_advice: advice,
  };
}
