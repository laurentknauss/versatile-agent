import { tool } from '@langchain/core/tools';
import fetch from 'node-fetch';
import { z } from 'zod';
import {
  CoinMarketData,
  CoinPrice
} from './types/gecko';



// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Build CoinGecko API URL with proper base URL based on API key type
 * - Demo keys (CG- prefix): https://api.coingecko.com/api/v3
 * - Pro keys: https://pro-api.coingecko.com/api/v3
 */
const buildCoinGeckoUrl = (endpoint: string, apiKey?: string): string => {
  const isDemoKey = apiKey?.startsWith('CG-');
  const baseUrl = isDemoKey
    ? 'https://api.coingecko.com/api/v3'
    : 'https://pro-api.coingecko.com/api/v3';
  return `${baseUrl}${endpoint}`;
};

/**
 * Build headers for CoinGecko API requests
 * - Demo keys use x-cg-demo-api-key header
 * - Pro keys use x-cg-pro-api-key header
 */
const buildHeaders = (apiKey?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'LangChain-CoinGecko-Tool/2.0.0'
  };

  if (apiKey) {
    const isDemoKey = apiKey.startsWith('CG-');
    headers[isDemoKey ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key'] = apiKey;
  }

  return headers;
};






// =============================================================================
// COINGECKO TOOLS
// =============================================================================

// Tool 1: Get cryptocurrency prices
const tracedCoinGeckoPriceTool = 
  async ({ coinIds, vsCurrencies, includeMarketCap, includeVolume, includePriceChange }: {
    coinIds: string;
    vsCurrencies?: string;
    includeMarketCap?: boolean;
    includeVolume?: boolean;
    includePriceChange?: boolean;
  }) => {
    const apiKey = process.env.COINGECKO_API_KEY;
    const currencies = vsCurrencies || 'usd';

    const params = new URLSearchParams({
      ids: coinIds,
      vs_currencies: currencies,
      include_market_cap: (includeMarketCap ?? true).toString(),
      include_24hr_vol: (includeVolume ?? true).toString(),
      include_24hr_change: (includePriceChange ?? true).toString(),
      include_last_updated_at: 'true'
    });

    const url = buildCoinGeckoUrl(`/simple/price?${params.toString()}`, apiKey);
    const headers = buildHeaders(apiKey);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`CoinGecko API Error: ${response.status} ${response.statusText}`, errorBody);
      if (response.status === 404) {
        return `❌ Sorry, I couldn't find price data for "${coinIds}". Please check the coin ID and try again.\n\n💡 Common coin IDs: bitcoin, ethereum, solana, cardano, polkadot, chainlink, avalanche-2, polygon, etc.`;
      }
      throw new Error(`CoinGecko API error! status: ${response.status}`);
    }

    const data = await response.json() as CoinPrice;

    // Build structured price data
    const prices: Array<Record<string, unknown>> = [];

    Object.entries(data).forEach(([coinId, priceData]) => {
      const entry: Record<string, unknown> = {
        coinId,
        name: coinId.replace(/-/g, ' ').toUpperCase(),
      };

      // Extract prices (keys without underscores)
      Object.entries(priceData).forEach(([key, value]) => {
        if (!key.includes('_') && typeof value === 'number') {
          entry[`price_${key}`] = value;
        }
      });

      // Add market cap if available
      const marketCapKey = Object.keys(priceData).find(k => k.includes('market_cap'));
      if (marketCapKey && priceData[marketCapKey]) {
        entry.marketCap = priceData[marketCapKey];
      }

      // Add volume if available
      const volumeKey = Object.keys(priceData).find(k => k.includes('24h_vol'));
      if (volumeKey && priceData[volumeKey]) {
        entry.volume24h = priceData[volumeKey];
      }

      // Add price change if available
      const changeKey = Object.keys(priceData).find(k => k.includes('24h_change'));
      if (changeKey && priceData[changeKey]) {
        entry.change24hPercent = priceData[changeKey];
      }

      // Add last updated timestamp if available
      const lastUpdated = priceData['last_updated_at'];
      if (lastUpdated) {
        entry.lastUpdatedAt = lastUpdated;
      }

      prices.push(entry);
    });

    return { type: 'crypto_prices', vsCurrencies: currencies, prices };
};



export const coinGeckoPriceTool = tool(tracedCoinGeckoPriceTool, {
  name: "coinGeckoPrice",
  description: "Get current cryptocurrency prices from CoinGecko. Use coin IDs like 'bitcoin', 'ethereum', 'solana', etc.",
  schema: z.object({
    coinIds: z.string().describe("Comma-separated list of coin IDs (e.g., 'bitcoin,ethereum,solana')"),
    vsCurrencies: z.string().optional().describe("Comma-separated list of currencies (default: 'usd')"),
    includeMarketCap: z.boolean().optional().describe("Include market cap data (default: true)"),
    includeVolume: z.boolean().optional().describe("Include 24h volume data (default: true)"),
    includePriceChange: z.boolean().optional().describe("Include 24h price change data (default: true)"),
  }),
});

// Tool 2 : Get market data for top crypto-currencies
const tracedCoinGeckoMarketTool = 
  async ({ vsCurrency , perPage, page, category, ids, priceChangePercentage, precision }: {
    vsCurrency? : string;
    perPage?: number;
    page?: number;
    category?: string;
    ids?: string;
    priceChangePercentage?: string;
    precision?: string;
  }) => {
    const apiKey = process.env.COINGECKO_API_KEY;
    const currency = vsCurrency || 'usd';
    const limit = Math.min(perPage || 10, 250 );
    const pageNum = page || 1 ;

    // Currency symbol map for display


     const params = new URLSearchParams({
    vs_currency: currency,
    order : 'market_cap_desc',
    per_page: limit.toString() ,
    sparkline : 'false'
  });
 if (category ) {
  params.append('category' , category );
 }
 if (ids) {
   params.append('ids', ids);
 }
 if (priceChangePercentage) {
   params.append('price_change_percentage', priceChangePercentage);
 }
 if (precision) {
   params.append('precision', precision);
 }
 if (pageNum > 1) {
   params.append('page', pageNum.toString());
 }

const url = buildCoinGeckoUrl(`/coins/markets?${params.toString()}`, apiKey);
const headers = buildHeaders(apiKey);

const response = await fetch(url, { headers });

if (!response.ok) {
  const errorBody = await response.text();
  let errorMsg = `CoinGecko API error! status: ${response.status}`;
  try {
    const err = JSON.parse(errorBody);
    if (err.error) errorMsg += ` — ${err.error}`;
  } catch {}
  if (category) {
    errorMsg += ` (category "${category}" may be invalid — use /coins/categories/list to find correct slugs)`;
  }
  throw new Error(errorMsg);
}

const data = await response.json() as CoinMarketData[];

    const marketData = data.map((coin) => ({
      rank: coin.market_cap_rank,
      coinId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      currentPrice: coin.current_price,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume ?? 0,
      change24hPercent: coin.price_change_percentage_24h,
      circulatingSupply: coin.circulating_supply,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
    }));

    return {
      type: 'crypto_market_data',
      currency,
      category: category ?? null,
      page: pageNum,
      perPage: limit,
      coins: marketData,
    };


}
export const coinGeckoMarketTool = tool (tracedCoinGeckoMarketTool, {
  name: "coinGeckoMarket" ,
  description : "Get market data for top crypto-currencies by market cap from CoinGecko. Supports filtering by category, coin IDs, and multi-timeframe price changes." ,
  schema : z.object({
    vsCurrency: z.string().optional().describe("The target currency (default : 'usd')"),
    perPage: z.number().optional().describe("Number of results per page (max 250, default: 10)"),
    page : z.number().optional().describe("Page number  (default : 1)" ) ,
    category: z.string().optional().describe("CoinGecko category slug. Common values: 'non-fungible-tokens-nft' (NFT), 'decentralized-finance-defi' (DeFi), 'gaming' (GameFi), 'meme-tokens' (Meme), 'ai-agents', 'ai-applications'. Use /coins/categories/list to discover all slugs."),
    ids: z.string().optional().describe("Comma-separated list of coin IDs to filter (e.g., 'bitcoin,ethereum,solana'). Overrides category filter."),
    priceChangePercentage: z.string().optional().describe("Comma-separated timeframes for price change: '1h,24h,7d,14d,30d,60d,200d,1y' (default: none)"),
    precision: z.string().optional().describe("Decimal precision: 'full' or '0'-'18' (default: API default)"),
  }),
});
















