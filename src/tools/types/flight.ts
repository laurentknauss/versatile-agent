/**
 * AirLabs Data API v9 — TypeScript Interfaces
 * https://airlabs.co/docs
 */

/** Flight status values returned by AirLabs */
export type FlightStatus = 'scheduled' | 'en-route' | 'landed';

/**
 * One live flight record — GET /api/v9/flights
 * ⚠️ Calibrated on real payloads (2026-09-24): AirLabs OMITS keys entirely
 * when data is unavailable (and occasionally sends explicit null) → every
 * field is optional. Private/light aircraft have no flight/airline info at all.
 */
export interface AirlabsFlight {
  // Identity
  flight_iata?: string | null; // e.g. "SU1459"
  flight_icao?: string | null; // e.g. "AFL1459"
  flight_number?: string | null;
  airline_iata?: string | null; // can be empty string ""
  airline_icao?: string | null;

  // Live position (ADS-B)
  lat?: number | null;
  lng?: number | null;
  alt?: number | null; // meters — absent on ground
  dir?: number | null; // heading 0-360
  speed?: number | null; // km/h horizontal — absent on ground
  v_speed?: number | null; // m/s vertical (observed: negative = descent)
  squawk?: string | null;
  hex?: string | null; // ICAO 24-bit address
  reg_number?: string | null; // aircraft registration
  flag?: string | null; // ISO 2 country code
  aircraft_icao?: string | null; // e.g. "A320", "B77W"

  // Route
  dep_iata?: string | null;
  dep_icao?: string | null;
  arr_iata?: string | null;
  arr_icao?: string | null;

  status?: FlightStatus | null; // observed: "scheduled" | "en-route" | "landed"
  updated?: number | null; // UNIX timestamp of last aircraft signal
  type?: string | null; // data source, observed: "adsb"
}

/** AirLabs wraps every successful payload in a top-level `response` field */
export interface AirlabsFlightsResponse {
  response: AirlabsFlight[];
}

/**
 * Full data sheet for ONE flight — GET /api/v9/flight?flight_iata=…
 * ⚠️ Calibrated on a real payload (2026-09-24): unlike /flights, this endpoint
 * returns a single OBJECT (not an array), and uses explicit `null` for unknown
 * values that the list endpoint would simply omit.
 */
export interface AirlabsFlightInfo {
  // Identity
  flight_iata?: string | null;
  flight_icao?: string | null;
  flight_number?: string | null;
  airline_iata?: string | null;
  airline_icao?: string | null;
  airline_name?: string | null;
  // Codeshare (marketing carrier) — shape observed on the wire
  cs_flight_iata?: string | null;
  cs_flight_number?: string | null;
  cs_airline_iata?: string | null;

  // Departure — times exist in local, UTC and UNIX flavours
  dep_iata?: string | null;
  dep_icao?: string | null;
  dep_name?: string | null; // airport label, e.g. "Charles De Gaulle"
  dep_city?: string | null;
  dep_country?: string | null;
  dep_terminal?: string | null;
  dep_gate?: string | null;
  dep_time?: string | null; // local airport time
  dep_estimated?: string | null;
  dep_actual?: string | null;
  dep_time_utc?: string | null;
  dep_estimated_utc?: string | null;
  dep_actual_utc?: string | null;
  dep_time_ts?: number | null;
  dep_estimated_ts?: number | null;
  dep_actual_ts?: number | null;
  dep_delayed?: number | null; // minutes

  // Arrival
  arr_iata?: string | null;
  arr_icao?: string | null;
  arr_name?: string | null;
  arr_city?: string | null;
  arr_country?: string | null;
  arr_terminal?: string | null;
  arr_gate?: string | null;
  arr_baggage?: string | null; // baggage claim carousel
  arr_time?: string | null;
  arr_estimated?: string | null;
  arr_actual?: string | null;
  arr_time_utc?: string | null;
  arr_estimated_utc?: string | null;
  arr_actual_utc?: string | null;
  arr_time_ts?: number | null;
  arr_estimated_ts?: number | null;
  arr_actual_ts?: number | null;
  arr_delayed?: number | null; // minutes

  // Flight state
  status?: FlightStatus | null;
  duration?: number | null; // minutes
  percent?: number | null; // progress along the route, 0-100 (computed by AirLabs)
  delayed?: number | null; // DEPRECATED upstream — prefer dep_delayed / arr_delayed
  updated?: number | null; // UNIX ts of last ADS-B signal
  type?: string | null; // data source, observed: "adsb"

  // Live position
  lat?: number | null;
  lng?: number | null;
  alt?: number | null; // meters
  dir?: number | null; // heading 0-360
  speed?: number | null; // km/h
  v_speed?: number | null; // m/s (negative = descent)

  // Aircraft
  aircraft_icao?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  reg_number?: string | null;
  hex?: string | null;
  flag?: string | null;
  age?: number | null; // years
  built?: number | null; // year
  msn?: string | null; // manufacturer serial number
  engine?: string | null;
  engine_count?: number | null;
}

/** ⚠️ `response` is `null` when the flight is not found — not an empty array. */
export interface AirlabsFlightInfoResponse {
  response: AirlabsFlightInfo | null;
}

/** One end of the route, as normalised for the agent and the UI. */
export interface FlightEndpoint {
  iata: string | null;
  airport: string | null;
  city: string | null;
  country: string | null;
  terminal: string | null;
  gate: string | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  delayMinutes: number | null;
  /** « +25 min » / « à l'heure » / null when AirLabs reports no delay. */
  delay: string | null;
}

/**
 * Normalised output of the flightTracker tool — snake_case wire fields folded
 * into camelCase, and every absent value turned into an explicit null so a
 * consumer (LLM or a generative-UI card) never has to test for `undefined`.
 */
export interface FlightTrackerResult {
  flight: {
    iata: string | null;
    icao: string | null;
    number: string | null;
    airline: string | null;
    airlineIata: string | null;
    codeshare: { iata: string | null; number: string | null; airlineIata: string | null } | null;
  };
  status: {
    code: string | null;
    label: string | null;
    progressPercent: number | null;
    durationMinutes: number | null;
  };
  departure: FlightEndpoint;
  arrival: FlightEndpoint & { baggageClaim: string | null };
  /** null when the aircraft is on the ground — no ADS-B position to report. */
  position: {
    latitude: number;
    longitude: number;
    altitudeMeters: number | null;
    headingDegrees: number | null;
    speedKmh: number | null;
    verticalSpeedMs: number | null;
    signalAgeSeconds: number | null;
    stale: boolean;
  } | null;
  aircraft: {
    type: string | null;
    model: string | null;
    manufacturer: string | null;
    registration: string | null;
    hex: string | null;
    builtYear: number | null;
    ageYears: number | null;
    engine: string | null;
  };
}

/** Error shape — HTTP 200 is NOT guaranteed; errors come back as { error } */
export interface AirlabsErrorResponse {
  error: {
    message: string;
    code:
      | 'unknown_api_key'
      | 'expired_api_key'
      | 'unknown_method'
      | 'wrong_params'
      | 'not_found'
      | 'minute_limit_exceeded'
      | 'hour_limit_exceeded'
      | 'month_limit_exceeded'
      | 'internal_error';
  };
}

// ---------------------------------------------------------------------------
// Airport board — GET /api/v9/schedules
// ---------------------------------------------------------------------------

/** Statuses seen on the board — a wider set than on /flight (adds `cancelled`). */
export type ScheduleStatus = 'scheduled' | 'cancelled' | 'active' | 'landed';

/**
 * One board row — GET /api/v9/schedules?dep_iata=… | ?arr_iata=…
 * ⚠️ AirLabs emits one row per MARKETING number: a single CDG→HAJ flight appears as
 * A51338 (the operator, whose `cs_flight_iata` is null), AF1338, AM5746, UU8338…
 * ⚠️ `status` is NOT the state of this row's movement: a flight departing one minute
 * from now was returned as "landed" (measured 2026-09-24) — trust the times instead.
 */
export interface AirlabsSchedule {
  airline_iata?: string | null;
  airline_icao?: string | null;
  flight_iata?: string | null;
  flight_icao?: string | null;
  flight_number?: string | null;
  cs_airline_iata?: string | null;
  cs_flight_iata?: string | null;
  cs_flight_number?: string | null;

  dep_iata?: string | null;
  dep_icao?: string | null;
  dep_terminal?: string | null;
  dep_gate?: string | null;
  dep_time?: string | null;
  dep_time_ts?: number | null;
  dep_time_utc?: string | null;
  dep_estimated?: string | null;
  dep_estimated_ts?: number | null;
  dep_estimated_utc?: string | null;
  dep_actual?: string | null;
  dep_actual_ts?: number | null;
  dep_actual_utc?: string | null;

  arr_iata?: string | null;
  arr_icao?: string | null;
  arr_terminal?: string | null;
  arr_gate?: string | null;
  arr_baggage?: string | null;
  arr_time?: string | null;
  arr_time_ts?: number | null;
  arr_time_utc?: string | null;
  arr_estimated?: string | null;
  arr_estimated_ts?: number | null;
  arr_estimated_utc?: string | null;
  arr_actual?: string | null;
  arr_actual_ts?: number | null;
  arr_actual_utc?: string | null;

  status?: ScheduleStatus | null;
  duration?: number | null; // minutes
  delayed?: number | null; // DEPRECATED upstream — prefer dep_delayed / arr_delayed
  dep_delayed?: number | null; // minutes
  arr_delayed?: number | null; // minutes
  aircraft_icao?: string | null;
}

/** The payload is one flat array of movements — there is no per-airport wrapper. */
export interface AirlabsScheduleResponse {
  response: AirlabsSchedule[] | null;
}

/** One physical movement: codeshares merged, fields normalised for the agent and the UI. */
export interface AirportBoardFlight {
  /** The flight actually operated — the only row without a codeshare pointer. */
  iata: string | null;
  airlineIata: string | null;
  airlineIcao: string | null;
  /** Other numbers this same flight is sold under. */
  marketingCodes: string[];
  /** The other end of the route: destination on departures, origin on arrivals. */
  counterpartIata: string | null;
  counterpartIcao: string | null;
  /** Times in the AIRPORT's local timezone, as AirLabs reports them. */
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  /** UNIX seconds — the only timezone-independent anchor (airports differ in offset). */
  scheduledTs: number | null;
  /** Minutes from now; negative when the movement has just happened. */
  minutesFromNow: number | null;
  delayMinutes: number | null;
  terminal: string | null;
  gate: string | null;
  /** Arrivals boards only — always null on a departures board. */
  baggageClaim: string | null;
  /** ⚠️ Status of the flight number's current occurrence, not of this movement. */
  airlabsStatus: string | null;
}

export interface AirportBoardResult {
  airport: string;
  direction: 'departures' | 'arrivals';
  observedAtUtc: string;
  /**
   * `false` quand AirLabs n'a renvoyé que des mouvements déjà passés : mesuré le
   * 2026-09-24, un hub épuise la fenêtre gratuite de 100 lignes avant maintenant
   * (CDG : 05:10→07:00 UTC quand il était 08:05 UTC), alors qu'un aéroport moyen
   * (HAJ, TFS, NCE) couvre 9 à 10 h à venir. Le tableau liste alors les mouvements
   * les plus proches de maintenant au lieu de ne rien montrer.
   */
  windowIsUpcoming: boolean;
  /** Ce qu'il faut dire à l'utilisateur quand la fenêtre est passée ; `null` sinon. */
  note: string | null;
  /** What AirLabs actually handed back: free plan = 100 movements max, 10 h ahead max. */
  coverage: {
    firstReturnedMovementUtc: string | null;
    lastReturnedMovementUtc: string | null;
    returnedRows: number;
    physicalFlights: number;
  };
  flightsOnBoard: number;
  shown: number;
  flights: AirportBoardFlight[];
}

// ---------------------------------------------------------------------------
// Name resolution — GET /api/v9/suggest + GET /api/v9/airlines
// ---------------------------------------------------------------------------

/** ⚠️ /suggest indexes airports, cities and countries — NOT airlines. */
export interface AirlabsSuggestedAirport {
  name?: string | null;
  iata_code?: string | null;
  icao_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  slug?: string | null;
  country_code?: string | null;
  popularity?: number | null;
  city_code?: string | null;
}

export interface AirlabsSuggestedCity {
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
  country_code?: string | null;
  popularity?: number | null;
  city_code?: string | null;
}

export interface AirlabsSuggestedCountry {
  name?: string | null;
  code?: string | null;
  code3?: string | null;
}

export interface AirlabsSuggestResponse {
  /** Four more keys exist (…_by_airports / …_by_countries) and are left unused. */
  response: {
    countries?: AirlabsSuggestedCountry[];
    cities?: AirlabsSuggestedCity[];
    airports?: AirlabsSuggestedAirport[];
  } | null;
}

/** GET /api/v9/airlines?name=… (fuzzy) | ?iata_code=… | ?icao_code=… */
export interface AirlabsAirline {
  name?: string | null;
  iata_code?: string | null;
  icao_code?: string | null;
}

export interface AirlabsAirlinesResponse {
  response: AirlabsAirline[] | null;
}

export interface AviationLookupResult {
  query: string;
  airports: {
    iata: string | null;
    icao: string | null;
    name: string | null;
    cityCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    popularity: number | null;
  }[];
  cities: {
    name: string | null;
    cityCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    popularity: number | null;
  }[];
  countries: { name: string | null; code: string | null; code3: string | null }[];
  airlines: { name: string | null; iata: string | null; icao: string | null }[];
  /** Half a lookup can fail on its own — an empty list alone would read as "no such thing". */
  warnings: string[];
}

export const isAirlabsError = (data: unknown): data is AirlabsErrorResponse =>
  typeof data === 'object' && data !== null && 'error' in data;
