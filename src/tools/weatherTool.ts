import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';
import { ForecastItem, ForecastResponse } from './types/weather';


/**
 * Format wind speed from m/s to km/h
 */
const windToKmh = (ms: number): number => Math.round(ms * 3.6);

/**
 * Get the wind direction arrow from degrees
 */
const windDir = (deg: number): string => {
  const dirs = ['⬆️ N', '↗️ NE', '➡️ E', '↘️ SE', '⬇️ S', '↙️ SW', '⬅️ W', '↖️ NW'];
  return dirs[Math.round(deg / 45) % 8];
};

/**
 * Get the most frequent weather description across all intervals for a day
 */
const dominantDescription = (descriptions: string[]): string => {
  if (!descriptions.length) return 'aucune donnée';
  const freq: Record<string, number> = {};
  descriptions.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
};

export const openWeatherMapTool = tool(
  async ({ city, country, days }: { city: string; country?: string; days?: number }) => {
    let apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error("OPENWEATHERMAP_API_KEY is not set");
    }
    apiKey = apiKey.replace(/["';]/g, '').trim();

    const location = country ? `${city},${country}` : city;
    const forecastDays = Math.max(1, Math.min(days ?? 3, 5));

    // Request max intervals (40 = 5 days at 3h intervals) to have enough data
    // after skipping today (J+1 shift)
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&cnt=40&lang=fr`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return `❌ Sorry, I couldn't find weather data for ${city}${country ? `, ${country}` : ''}. Please check the city name and try again.`;
      }
      if (response.status === 401) {
        return `🔑 API key error. Please check your OpenWeatherMap API key.`;
      }
      throw new Error(`OpenWeatherMap API error! status: ${response.status}`);
    }

    const data = await response.json() as ForecastResponse;

    if (!data.list || data.list.length === 0) {
      return `❌ No weather data available for ${city}.`;
    }

    // Destination timezone offset (seconds from UTC)
    const tzOffset = data.city?.timezone ?? 0;

    // Today's date at the destination (for J+1 shift)
    // Note: Date.now() is ms, tzOffset is seconds — convert tzOffset to ms
    const todayStr = new Date(Date.now() + tzOffset * 1000).toISOString().split('T')[0];

    // Group forecast by local date (J+1 onward)
    const forecastByDay: Record<string, {
      temps: number[];
      feelsLikes: number[];
      descriptions: string[];
      humidities: number[];
      windSpeeds: number[];
      windDegs: number[];
      rain: number;
      pop: number;
    }> = {};

    for (const item of data.list) {
      // Compute local date using destination timezone
      const localDate = new Date((item.dt + tzOffset) * 1000).toISOString().split('T')[0];

      // J+1 shift: skip today's data
      if (localDate <= todayStr) continue;

      if (!forecastByDay[localDate]) {
        forecastByDay[localDate] = {
          temps: [],
          feelsLikes: [],
          descriptions: [],
          humidities: [],
          windSpeeds: [],
          windDegs: [],
          rain: 0,
          pop: 0,
        };
      }

      const day = forecastByDay[localDate];
      day.temps.push(item.main.temp);
      day.feelsLikes.push(item.main.feels_like);
      day.humidities.push(item.main.humidity);
      day.windSpeeds.push(item.wind?.speed ?? 0);
      day.windDegs.push(item.wind?.deg ?? 0);
      if (item.weather?.[0]?.description) {
        day.descriptions.push(item.weather[0].description);
      }
      // Accumulate max rain volume
      if (item.rain?.['3h']) {
        day.rain = Math.max(day.rain, item.rain['3h']);
      }
      // Use max probability of precipitation
      if (item.pop > day.pop) {
        day.pop = item.pop;
      }
    }

    // Sort dates chronologically and take requested days
    const dates = Object.keys(forecastByDay)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .slice(0, forecastDays);

    if (dates.length === 0) {
      return `❌ No upcoming forecast data available for ${city}${country ? `, ${country}` : ''}. Try again later.`;
    }

    const locationName = `${data.city.name}, ${data.city.country}`;

    // Format date as DD/MM
    const fmtDate = (iso: string): string => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}`;
    };


const forecast = dates.map(date => {
  const day = forecastByDay[date];

  // Average temperature
  const avgTemp = Math.round(
    day.temps.reduce((a, b) => a + b, 0) / day.temps.length
  );

  const minTemp = Math.round(Math.min(...day.temps));
  const maxTemp = Math.round(Math.max(...day.temps));

  const feelsLike = Math.round(
    day.feelsLikes.reduce((a, b) => a + b, 0) / day.feelsLikes.length
  );

  // Dominant weather description
  const desc = dominantDescription(day.descriptions);

  // Average wind speed + direction
  const avgWind = windToKmh(
    day.windSpeeds.reduce((a, b) => a + b, 0) / day.windSpeeds.length
  );

  const avgWindDeg = Math.round(
    day.windDegs.reduce((a, b) => a + b, 0) / day.windDegs.length
  );

  // Average humidity
  const avgHum = Math.round(
    day.humidities.reduce((a, b) => a + b, 0) / day.humidities.length
  );

  // Precipitation probability
  const popPercent = Math.round(day.pop * 100);

  return {
    date,
    temperature: {
      averageCelsius: avgTemp,
      minCelsius: minTemp,
      maxCelsius: maxTemp,
      feelsLikeCelsius: feelsLike,
    },
    weather: desc,
    wind: {
      speedKmh: avgWind,
      directionDegrees: avgWindDeg,
      direction: windDir(avgWindDeg),
    },
    humidityPercent: avgHum,
    rainMm: Number(day.rain.toFixed(1)),
    precipitationProbabilityPercent: popPercent,
  };
});

























/**
    const shownDays = dates.length;
    const label = shownDays < forecastDays
      ? `(prévisions disponibles pour les ${shownDays} prochains jours)`
      : `(prévisions pour les ${forecastDays} prochains jours, à partir de demain)`;

    return `🌤️ **Météo pour ${locationName}** ${label} :\n${forecastList.join('\n')}`;
    */
const shownDays = dates.length;

return {
  location: {
    city: data.city.name,
    country: data.city.country,
  },
  forecastDaysRequested: forecastDays,
  forecastDaysReturned: shownDays,
  forecastStarting: "tomorrow",
  forecast,
};


  },
  {
    name: "openWeatherMap",
    description: "Retrieves weather forecasts for a given city with temperature, wind, humidity, rain, and precipitation probability. Skips today's data — shows J+1 onward.",
    schema: z.object({
      city: z.string().describe("The name of the city to get the weather for."),
      country: z.string().optional().describe("The country code of the city (optional)."),
      days: z.number().min(1).max(5).optional().describe("Number of forecast days starting from tomorrow (1-5, default: 3)."),
    }),
  }
);
