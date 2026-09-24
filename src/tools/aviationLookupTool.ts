import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { airlabsGet } from './airlabsClient';
import type {
  AirlabsAirlinesResponse,
  AirlabsSuggestResponse,
  AviationLookupResult,
} from './types/flight';

/** Results kept per category when the caller does not say. */
const DEFAULT_LIMIT = 5;

export const aviationLookupTool = tool(
  async ({
    name,
    limit,
  }: {
    name: string;
    limit?: number;
  }): Promise<string | AviationLookupResult> => {
    // /suggest covers airports, cities and countries but NOT airlines — "air france"
    // comes back as five airports — so airline names need /airlines (fuzzy on `name`).
    // Two requests per lookup, issued together: this tool is called rarely, and one
    // round trip beats a schema the model has to reason about.
    const [suggest, airlines] = await Promise.all([
      airlabsGet<AirlabsSuggestResponse>('suggest', { query: name }),
      airlabsGet<AirlabsAirlinesResponse>('airlines', { name }),
    ]);

    if (!suggest.ok && !airlines.ok) return suggest.message;

    const top = limit ?? DEFAULT_LIMIT;

    const lookup: AviationLookupResult = {
      query: name,
      airports: (suggest.ok ? (suggest.data.response?.airports ?? []) : [])
        .slice()
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, top)
        .map((airport) => ({
          iata: airport.iata_code ?? null,
          icao: airport.icao_code ?? null,
          name: airport.name ?? null,
          cityCode: airport.city_code ?? null,
          country: airport.country_code ?? null,
          latitude: airport.lat ?? null,
          longitude: airport.lng ?? null,
          popularity: airport.popularity ?? null,
        })),
      cities: (suggest.ok ? (suggest.data.response?.cities ?? []) : [])
        .slice()
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, top)
        .map((city) => ({
          name: city.name ?? null,
          cityCode: city.city_code ?? null,
          country: city.country_code ?? null,
          latitude: city.lat ?? null,
          longitude: city.lng ?? null,
          popularity: city.popularity ?? null,
        })),
      countries: (suggest.ok ? (suggest.data.response?.countries ?? []) : [])
        .slice(0, top)
        .map((country) => ({
          name: country.name ?? null,
          code: country.code ?? null,
          code3: country.code3 ?? null,
        })),
      airlines: (airlines.ok ? (airlines.data.response ?? []) : [])
        .slice(0, top)
        .map((airline) => ({
          name: airline.name ?? null,
          iata: airline.iata_code ?? null,
          icao: airline.icao_code ?? null,
        })),
      // A silent empty list would read as "this airline does not exist" when the
      // truth is "that half of the lookup failed".
      warnings: [suggest.ok ? null : suggest.message, airlines.ok ? null : airlines.message].filter(
        (message): message is string => message != null
      ),
    };

    if (
      lookup.airports.length === 0 &&
      lookup.cities.length === 0 &&
      lookup.countries.length === 0 &&
      lookup.airlines.length === 0
    ) {
      return `❌ Aucun aéroport, ville, pays ni compagnie ne correspond à « ${name} ». Vérifier l'orthographe, ou demander le code IATA directement.`;
    }

    return lookup;
  },
  {
    name: 'aviationLookup',
    description:
      'Resolves a place or airline NAME to its codes: airports (IATA + ICAO + coordinates), cities, countries and airlines, most popular first. Call it before flightTracker or airportBoard whenever the user names a city or an airline instead of a code — e.g. "Tenerife" → TFS/TFN, "Paris" → CDG/ORY, "easyJet" → U2. It returns codes only: no live status, no schedule.',
    schema: z.object({
      name: z
        .string()
        .min(2)
        .describe("Place or airline name to resolve, e.g. 'Tenerife', 'Paris', 'easyJet'."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(5)
        .describe('Maximum results per category (1-10), most popular first.'),
    }),
  }
);
