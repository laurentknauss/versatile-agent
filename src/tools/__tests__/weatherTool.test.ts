import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openWeatherMapTool } from '../weatherTool';

process.env.OPENWEATHERMAP_API_KEY = 'test-api-key-12345';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mockFetch,
}));

const makeItem = (dt: number, dt_txt: string, temp: number, desc: string, mainDesc: string, opts?: {
  feels_like?: number;
  temp_min?: number;
  temp_max?: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDeg?: number;
  rain?: number;
  pop?: number;
}) => ({
  dt,
  dt_txt,
  main: {
    temp,
    feels_like: opts?.feels_like ?? temp - 1,
    temp_min: opts?.temp_min ?? temp - 2,
    temp_max: opts?.temp_max ?? temp + 2,
    pressure: opts?.pressure ?? 1015,
    humidity: opts?.humidity ?? 65,
  },
  weather: [{ description: desc, main: mainDesc }],
  clouds: { all: 50 },
  wind: { speed: opts?.windSpeed ?? 3.5, deg: opts?.windDeg ?? 180, gust: 5.0 },
  pop: opts?.pop ?? 0.1,
  visibility: 10000,
  ...(opts?.rain ? { rain: { '3h': opts.rain } } : {}),
});

describe('openWeatherMapTool', () => {
  describe('Tool metadata', () => {
    it('should exist and be defined', () => {
      expect(openWeatherMapTool).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(openWeatherMapTool.name).toBe('openWeatherMap');
    });

    it('should have a description mentioning weather', () => {
      expect(openWeatherMapTool.description).toContain('weather');
    });
  });

  describe('Schema validation', () => {
    it('should require city', () => {
      expect(openWeatherMapTool.schema.shape).toHaveProperty('city');
    });

    it('should accept city only', () => {
      expect(openWeatherMapTool.schema.safeParse({ city: 'Paris' }).success).toBe(true);
    });

    it('should accept optional country', () => {
      expect(openWeatherMapTool.schema.safeParse({ city: 'London', country: 'UK' }).success).toBe(true);
    });

    it('should accept optional days between 1 and 5', () => {
      expect(openWeatherMapTool.schema.safeParse({ city: 'Tokyo', days: 3 }).success).toBe(true);
    });

    it('should reject days less than 1', () => {
      expect(openWeatherMapTool.schema.safeParse({ city: 'Paris', days: 0 }).success).toBe(false);
    });

    it('should reject days greater than 5', () => {
      expect(openWeatherMapTool.schema.safeParse({ city: 'Paris', days: 7 }).success).toBe(false);
    });

    it('should reject empty object', () => {
      expect(openWeatherMapTool.schema.safeParse({}).success).toBe(false);
    });
  });

  describe('With mocked fetch', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should return structured object with location and forecast array', async () => {
      const tzOffset = 7200;
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          list: [
            makeItem(1717200000, '2024-06-01 12:00:00', 24, 'ciel dégagé', 'Clear', { feels_like: 23, windSpeed: 4.2, windDeg: 200, humidity: 55 }),
            makeItem(1717286400, '2024-06-02 12:00:00', 22, 'pluie légère', 'Rain', { feels_like: 20, windSpeed: 5.1, windDeg: 220, humidity: 72, rain: 1.2, pop: 0.6 }),
            makeItem(1717372800, '2024-06-03 12:00:00', 20, 'ciel dégagé', 'Clear', { feels_like: 19, windSpeed: 3.0, windDeg: 180, humidity: 50 }),
          ],
          city: { id: 2988507, name: 'Paris', country: 'FR', timezone: tzOffset, sunrise: 1717200000, sunset: 1717250000 },
        }),
      });

      const result: any = await openWeatherMapTool.invoke({ city: 'Paris' });
      expect(result.location.city).toBe('Paris');
      expect(result.location.country).toBe('FR');
      expect(result.forecastStarting).toBe('tomorrow');
      expect(result.forecast).toHaveLength(2); // J+1 and J+2, today skipped
      expect(result.forecast[0].date).toBe('2024-06-02');
      expect(result.forecast[0].temperature.averageCelsius).toBe(22);
      expect(result.forecast[0].weather).toBe('pluie légère');
      expect(result.forecast[0].wind.speedKmh).toBe(18); // 5.1 m/s * 3.6
      expect(result.forecast[0].humidityPercent).toBe(72);
      expect(result.forecast[0].rainMm).toBe(1.2);
      expect(result.forecast[0].precipitationProbabilityPercent).toBe(60);

      vi.useRealTimers();
    });

    it('should handle 404 city not found', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      const result = await openWeatherMapTool.invoke({ city: 'Atlantis' });
      expect(result).toContain('Sorry');
    });

    it('should handle 401 API key error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      const result = await openWeatherMapTool.invoke({ city: 'Paris' });
      expect(result).toContain('API key error');
    });

    it('should handle empty forecast data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ list: [], city: { id: 0, name: 'Nowhere', country: 'XX', timezone: 0, sunrise: 0, sunset: 0 } }),
      });
      const result = await openWeatherMapTool.invoke({ city: 'Nowhere' });
      expect(result).toContain('No weather data');
    });

    it('should throw on unexpected HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 });
      await expect(openWeatherMapTool.invoke({ city: 'Paris' })).rejects.toThrow();
    });

    it('should include wind speed and direction in each forecast day', async () => {
      const tzOffset = 7200;
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          list: [makeItem(1717286400, '2024-06-02 12:00:00', 22, 'ciel dégagé', 'Clear', { windSpeed: 7.0, windDeg: 270 })],
          city: { id: 2988507, name: 'Paris', country: 'FR', timezone: tzOffset, sunrise: 1717200000, sunset: 1717250000 },
        }),
      });

      const result: any = await openWeatherMapTool.invoke({ city: 'Paris' });
      expect(result.forecast[0].wind.speedKmh).toBe(25); // 7 m/s * 3.6
      expect(result.forecast[0].wind.direction).toBe('⬅️ W');

      vi.useRealTimers();
    });

    it('should include rain amount when available', async () => {
      const tzOffset = 7200;
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          list: [makeItem(1717286400, '2024-06-02 12:00:00', 18, 'pluie modérée', 'Rain', { rain: 3.5, pop: 0.8 })],
          city: { id: 2988507, name: 'Paris', country: 'FR', timezone: tzOffset, sunrise: 1717200000, sunset: 1717250000 },
        }),
      });

      const result: any = await openWeatherMapTool.invoke({ city: 'Paris' });
      expect(result.forecast[0].rainMm).toBe(3.5);
      expect(result.forecast[0].precipitationProbabilityPercent).toBe(80);

      vi.useRealTimers();
    });

    it('should show feels-like temperature', async () => {
      const tzOffset = 7200;
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          list: [makeItem(1717286400, '2024-06-02 12:00:00', 30, 'ciel dégagé', 'Clear', { feels_like: 33 })],
          city: { id: 2988507, name: 'Paris', country: 'FR', timezone: tzOffset, sunrise: 1717200000, sunset: 1717250000 },
        }),
      });

      const result: any = await openWeatherMapTool.invoke({ city: 'Paris' });
      expect(result.forecast[0].temperature.feelsLikeCelsius).toBe(33);

      vi.useRealTimers();
    });
  });
});