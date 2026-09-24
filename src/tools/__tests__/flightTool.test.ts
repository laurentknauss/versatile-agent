import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flightTrackerTool } from '../flightTool';
import type { FlightTrackerResult } from '../types/flight';

process.env.AIRLABS_API_KEY = 'test-api-key-12345';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mockFetch,
}));

/**
 * Wire shape of GET /api/v9/flight — calibrated on a real payload (2026-09-24).
 * Spread over it to override one field per test: { ...flightInfo, dep_delayed: 25 }
 */
const flightInfo = {
  flight_iata: 'AF6',
  flight_icao: 'AFR6',
  flight_number: '6',
  airline_iata: 'AF',
  airline_name: 'Air France',
  cs_flight_iata: 'DL8456',
  cs_flight_number: '8456',
  cs_airline_iata: 'DL',
  dep_iata: 'CDG',
  dep_name: 'Paris Charles de Gaulle Airport',
  dep_city: 'Paris',
  dep_country: 'FR',
  dep_terminal: '2E',
  dep_gate: 'K21',
  dep_time: '2026-09-24 10:30',
  dep_estimated: '2026-09-24 10:42',
  dep_actual: '2026-09-24 10:42',
  dep_delayed: 12,
  arr_iata: 'JFK',
  arr_name: 'John F Kennedy International Airport',
  arr_city: 'New York',
  arr_country: 'US',
  arr_terminal: '4',
  arr_gate: 'B31',
  arr_baggage: '12',
  arr_time: '2026-09-24 13:05',
  arr_estimated: '2026-09-24 13:02',
  arr_actual: null,
  arr_delayed: null,
  status: 'en-route',
  duration: 455,
  percent: 62,
  updated: 1790229587,
  type: 'adsb',
  lat: 51.5,
  lng: -30.25,
  alt: 11400,
  dir: 287,
  speed: 905,
  v_speed: -2,
  aircraft_icao: 'B77W',
  model: 'Boeing 777-300ER',
  manufacturer: 'BOEING',
  reg_number: 'F-GSQJ',
  hex: '3991A2',
  built: 2013,
  age: 13,
  engine: 'jet',
};

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

/**
 * The tool returns `string` for its error paths and the structured result
 * otherwise; every test below mocks a successful payload, so a string here
 * means the mapping silently fell through to an error branch.
 */
const structured = (result: string | FlightTrackerResult): FlightTrackerResult => {
  if (typeof result === 'string') {
    throw new Error(`expected a structured result, got the message: ${result}`);
  }
  return result;
};

describe('flightTrackerTool', () => {
  describe('Tool metadata', () => {
    it('should be named flightTracker', () => {
      expect(flightTrackerTool.name).toBe('flightTracker');
    });

    it('should state that prices and future dates are out of scope', () => {
      // The model routes on this: without the limit, it promises ticket searches.
      expect(flightTrackerTool.description).toContain('prices');
      expect(flightTrackerTool.description).toContain('future');
    });
  });

  describe('Schema validation', () => {
    it('should require flightIata', () => {
      expect(flightTrackerTool.schema.shape).toHaveProperty('flightIata');
    });

    it('should reject an empty object', () => {
      // An unfiltered AirLabs call returns the whole world feed (>3 MB measured).
      expect(flightTrackerTool.schema.safeParse({}).success).toBe(false);
    });

    it('should accept a standard flight number', () => {
      expect(flightTrackerTool.schema.safeParse({ flightIata: 'AF6' }).success).toBe(true);
    });

    it('should accept lowercase input', () => {
      expect(flightTrackerTool.schema.safeParse({ flightIata: 'u24573' }).success).toBe(true);
    });

    it('should accept a digit-prefixed airline code', () => {
      // "9C8528" and "B0101" are real flights — a ^[A-Z]{2} regex would drop them.
      expect(flightTrackerTool.schema.safeParse({ flightIata: '9C8528' }).success).toBe(true);
      expect(flightTrackerTool.schema.safeParse({ flightIata: 'B0101' }).success).toBe(true);
    });

    it('should reject malformed flight numbers', () => {
      expect(flightTrackerTool.schema.safeParse({ flightIata: 'pas-un-vol' }).success).toBe(false);
      expect(flightTrackerTool.schema.safeParse({ flightIata: 'AF' }).success).toBe(false);
      expect(flightTrackerTool.schema.safeParse({ flightIata: 'AF123456' }).success).toBe(false);
    });
  });

  describe('With mocked fetch', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should send the flight number and the API key in the query string', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: flightInfo }));

      await flightTrackerTool.invoke({ flightIata: 'AF6' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/flight?flight_iata=AF6');
      expect(url).toContain('api_key=test-api-key-12345');
    });

    it('should map the payload to the structured result', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: flightInfo }));

      const result = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));

      expect(result.flight.iata).toBe('AF6');
      expect(result.flight.airline).toBe('Air France');
      expect(result.flight.codeshare).toEqual({
        iata: 'DL8456',
        number: '8456',
        airlineIata: 'DL',
      });
      expect(result.status.code).toBe('en-route');
      expect(result.status.label).toBe('en vol');
      expect(result.status.progressPercent).toBe(62);
      expect(result.departure).toMatchObject({
        iata: 'CDG',
        city: 'Paris',
        terminal: '2E',
        gate: 'K21',
        scheduled: '2026-09-24 10:30',
        actual: '2026-09-24 10:42',
      });
      expect(result.arrival.baggageClaim).toBe('12');
      expect(result.arrival.gate).toBe('B31');
      expect(result.arrival.actual).toBeNull();
      expect(result.position).toMatchObject({
        latitude: 51.5,
        longitude: -30.25,
        altitudeMeters: 11400,
      });
      expect(result.aircraft).toMatchObject({
        type: 'B77W',
        registration: 'F-GSQJ',
        builtYear: 2013,
      });
    });

    it('should render a positive delay as +N min', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: flightInfo }));

      const result = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));

      expect(result.departure.delayMinutes).toBe(12);
      expect(result.departure.delay).toBe('+12 min');
    });

    it('should render a zero delay as on time', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: { ...flightInfo, dep_delayed: 0 } }));

      const result = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));

      expect(result.departure.delay).toBe("à l'heure");
    });

    it('should report an unknown delay as null rather than on time', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: { ...flightInfo, dep_delayed: null } }));

      const result = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));

      expect(result.departure.delay).toBeNull();
      expect(result.departure.delayMinutes).toBeNull();
    });

    it('should fall back to the raw status code when AirLabs adds a new one', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: { ...flightInfo, status: 'diverted' } }));

      const result = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));

      expect(result.status.label).toBe('diverted');
    });

    it('should omit the position when the aircraft is on the ground', async () => {
      mockFetch.mockResolvedValue(
        okResponse({ response: { ...flightInfo, lat: null, lng: null } })
      );

      const result = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));

      expect(result.position).toBeNull();
      expect(result.aircraft.type).toBe('B77W');
    });

    it('should flag a stale ADS-B signal', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
      const nowSeconds = Math.floor(Date.now() / 1000);

      mockFetch.mockResolvedValue(
        okResponse({ response: { ...flightInfo, updated: nowSeconds - 600 } })
      );
      const stale = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));
      expect(stale.position?.signalAgeSeconds).toBe(600);
      expect(stale.position?.stale).toBe(true);

      mockFetch.mockResolvedValue(
        okResponse({ response: { ...flightInfo, updated: nowSeconds - 10 } })
      );
      const fresh = structured(await flightTrackerTool.invoke({ flightIata: 'AF6' }));
      expect(fresh.position?.signalAgeSeconds).toBe(10);
      expect(fresh.position?.stale).toBe(false);

      vi.useRealTimers();
    });

    it('should surface a quota error carried inside an HTTP 200 body', async () => {
      mockFetch.mockResolvedValue(
        okResponse({ error: { message: 'Monthly quota exceeded', code: 'month_limit_exceeded' } })
      );

      const result = await flightTrackerTool.invoke({ flightIata: 'AF6' });

      expect(result).toContain('1 000 req/mois');
    });

    it('should surface an unknown API key carried inside an HTTP 200 body', async () => {
      mockFetch.mockResolvedValue(
        okResponse({ error: { message: 'Unknown api_key', code: 'unknown_api_key' } })
      );

      const result = await flightTrackerTool.invoke({ flightIata: 'AF6' });

      expect(result).toContain('AIRLABS_API_KEY');
    });

    it('should report an unknown error code verbatim', async () => {
      mockFetch.mockResolvedValue(
        okResponse({ error: { message: 'Something new upstream', code: 'brand_new_code' } })
      );

      const result = await flightTrackerTool.invoke({ flightIata: 'AF6' });

      expect(result).toContain('Something new upstream');
    });

    it('should report a flight that is not in the feed', async () => {
      mockFetch.mockResolvedValue(okResponse({ response: null }));

      const result = await flightTrackerTool.invoke({ flightIata: 'ZZ9999' });

      expect(result).toContain('Aucun vol');
      expect(result).toContain('temps réel');
    });

    it('should reject an unauthorized response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

      const result = await flightTrackerTool.invoke({ flightIata: 'AF6' });

      expect(result).toContain('AIRLABS_API_KEY');
    });

    it('should throw on an unexpected HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

      await expect(flightTrackerTool.invoke({ flightIata: 'AF6' })).rejects.toThrow();
    });

    it('should throw when the API key is missing', async () => {
      const saved = process.env.AIRLABS_API_KEY;
      delete process.env.AIRLABS_API_KEY;

      await expect(flightTrackerTool.invoke({ flightIata: 'AF6' })).rejects.toThrow(
        'AIRLABS_API_KEY is not set'
      );

      process.env.AIRLABS_API_KEY = saved;
    });
  });
});
