/**
 * OpenWeatherMap API TypeScript Interfaces
 */

export interface ForecastItem {
  dt: number; // Unix timestamp UTC
  dt_txt: string; // Human-readable UTC time
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  weather: {
    description: string;
    main: string;
  }[];
  clouds: {
    all: number;
  };
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  rain?: {
    '3h': number;
  };
  snow?: {
    '3h': number;
  };
  pop: number; // Probability of precipitation (0-1)
  visibility: number; // meters
}

export interface ForecastResponse {
  list: ForecastItem[];
  city: {
    id: number;
    name: string;
    country: string;
    timezone: number; // Shift in seconds from UTC
    sunrise: number;
    sunset: number;
  };
}