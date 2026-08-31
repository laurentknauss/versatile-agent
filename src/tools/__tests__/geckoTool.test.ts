import { describe, it, expect, beforeEach, vi } from 'vitest';
import { coinGeckoPriceTool, coinGeckoMarketTool } from '../geckoTool';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mockFetch,
}));

describe('coinGeckoPriceTool', () => {
  describe('Tool metadata', () => {
    it('should exist and be defined', () => {
      expect(coinGeckoPriceTool).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(coinGeckoPriceTool.name).toBe('coinGeckoPrice');
    });

    it('should have a description mentioning CoinGecko', () => {
      expect(coinGeckoPriceTool.description).toContain('CoinGecko');
    });

    it('should have a schema with required coinIds', () => {
      expect(coinGeckoPriceTool.schema.shape).toHaveProperty('coinIds');
    });
  });

  describe('Schema validation', () => {
    it('should accept coinIds as required string', () => {
      const result = coinGeckoPriceTool.schema.safeParse({ coinIds: 'bitcoin' });
      expect(result.success).toBe(true);
    });

    it('should accept vsCurrencies as optional', () => {
      const result = coinGeckoPriceTool.schema.safeParse({ coinIds: 'bitcoin', vsCurrencies: 'eur,usd' });
      expect(result.success).toBe(true);
    });

    it('should accept optional boolean flags', () => {
      const result = coinGeckoPriceTool.schema.safeParse({ coinIds: 'bitcoin', includeMarketCap: false, includeVolume: true });
      expect(result.success).toBe(true);
    });
  });

  describe('With mocked fetch', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should return structured object with type, vsCurrencies and prices array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          bitcoin: {
            usd: 65000,
            usd_market_cap: 1270000000000,
            usd_24h_vol: 28000000000,
            usd_24h_change: 2.5,
            last_updated_at: 1690000000,
          },
        }),
      });

      const result: any = await coinGeckoPriceTool.invoke({ coinIds: 'bitcoin' });
      expect(result.type).toBe('crypto_prices');
      expect(result.vsCurrencies).toBe('usd');
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].coinId).toBe('bitcoin');
      expect(result.prices[0].price_usd).toBe(65000);
      expect(result.prices[0].marketCap).toBe(1270000000000);
      expect(result.prices[0].volume24h).toBe(28000000000);
      expect(result.prices[0].change24hPercent).toBe(2.5);
      expect(result.prices[0].lastUpdatedAt).toBe(1690000000);
    });

    it('should handle multiple coins', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 65000, usd_market_cap: 1270000000000 },
          ethereum: { usd: 3500, usd_market_cap: 420000000000 },
        }),
      });

      const result: any = await coinGeckoPriceTool.invoke({ coinIds: 'bitcoin,ethereum' });
      expect(result.prices).toHaveLength(2);
      expect(result.prices[0].coinId).toBe('bitcoin');
      expect(result.prices[1].coinId).toBe('ethereum');
    });

    it('should handle 404 with a friendly message', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 404, statusText: 'Not Found',
        text: async () => 'Not Found',
      });

      const result = await coinGeckoPriceTool.invoke({ coinIds: 'nonexistentcoin' });
      expect(result).toContain('Sorry');
      expect(result).toContain('check the coin ID');
    });

    it('should throw on server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false, status: 500, statusText: 'Internal Error',
        text: async () => 'Server Error',
      });

      await expect(coinGeckoPriceTool.invoke({ coinIds: 'bitcoin' })).rejects.toThrow();
    });
  });
});

describe('coinGeckoMarketTool', () => {
  describe('Tool metadata', () => {
    it('should exist and be defined', () => {
      expect(coinGeckoMarketTool).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(coinGeckoMarketTool.name).toBe('coinGeckoMarket');
    });
  });

  describe('Schema validation', () => {
    it('should accept empty params', () => {
      expect(coinGeckoMarketTool.schema.safeParse({}).success).toBe(true);
    });

    it('should accept perPage', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ perPage: 50 }).success).toBe(true);
    });

    it('should accept category', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ category: 'decentralized-finance-defi' }).success).toBe(true);
    });

    it('should accept page and vsCurrency', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ page: 2, vsCurrency: 'eur' }).success).toBe(true);
    });

    it('should accept ids filter', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ ids: 'bitcoin,ethereum' }).success).toBe(true);
    });

    it('should accept priceChangePercentage', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ priceChangePercentage: '1h,24h,7d' }).success).toBe(true);
    });

    it('should accept precision', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ precision: 'full' }).success).toBe(true);
    });

    it('should accept all new parameters together', () => {
      expect(coinGeckoMarketTool.schema.safeParse({ ids: 'bitcoin', priceChangePercentage: '24h', precision: '2', vsCurrency: 'eur' }).success).toBe(true);
    });
  });

  describe('With mocked fetch', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    const makeMockCoin = (rank: number): any => ({
      id: `coin-${rank}`,
      symbol: `C${rank}`,
      name: `Token ${rank}`,
      image: '',
      current_price: 100 * rank,
      market_cap: 1000000000 * rank,
      market_cap_rank: rank,
      total_volume: 50000000 * rank,
      high_24h: 110 * rank,
      low_24h: 90 * rank,
      price_change_24h: 5 * rank,
      price_change_percentage_24h: 3.5 + rank,
      market_cap_change_24h: 10000000,
      market_cap_change_percentage_24h: 1.5,
      circulating_supply: 10000000 * rank,
      total_supply: 20000000 * rank,
      max_supply: 21000000 * rank,
      ath: 500 * rank,
      ath_change_percentage: -20,
      ath_date: '2024-01-01',
      atl: 1 * rank,
      atl_change_percentage: 10000,
      atl_date: '2020-01-01',
      roi: null,
      last_updated: '2024-06-01T00:00:00.000Z',
    });

    it('should return structured object with coins array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [makeMockCoin(1), makeMockCoin(2), makeMockCoin(3)],
      });

      const result: any = await coinGeckoMarketTool.invoke({ perPage: 3 });
      expect(result.type).toBe('crypto_market_data');
      expect(result.currency).toBe('usd');
      expect(result.coins).toHaveLength(3);
      expect(result.coins[0].name).toBe('Token 1');
      expect(result.coins[0].symbol).toBe('C1');
      expect(result.coins[0].rank).toBe(1);
    });

    it('should include category when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [makeMockCoin(1)],
      });

      const result: any = await coinGeckoMarketTool.invoke({ perPage: 1, category: 'non-fungible-tokens-nft' });
      expect(result.category).toBe('non-fungible-tokens-nft');
    });

    it('should set category to null when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [makeMockCoin(1)],
      });

      const result: any = await coinGeckoMarketTool.invoke({ perPage: 1 });
      expect(result.category).toBeNull();
    });

    it('should include page number in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [makeMockCoin(1)],
      });

      const result: any = await coinGeckoMarketTool.invoke({ perPage: 1, page: 2 });
      expect(result.page).toBe(2);
    });

    it('should include circulating supply and price data per coin', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [makeMockCoin(1)],
      });

      const result: any = await coinGeckoMarketTool.invoke({ perPage: 1 });
      expect(result.coins[0].circulatingSupply).toBe(10000000);
      expect(result.coins[0].currentPrice).toBe(100);
      expect(result.coins[0].change24hPercent).toBe(4.5);
    });

    it('should pass through vsCurrency to response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [makeMockCoin(1)],
      });

      const result: any = await coinGeckoMarketTool.invoke({ perPage: 1, vsCurrency: 'eur' });
      expect(result.currency).toBe('eur');
    });
  });
});