/**
 * CoinGecko API TypeScript Interfaces
 */

// =============================================================================
// BASIC PRICE DATA INTERFACES
// =============================================================================

export interface CoinPrice {
  [coinId: string]: {
    [field: string]: number;
  };
}

// =============================================================================
// MARKET DATA INTERFACES
// =============================================================================

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number | null;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: {
    times: number;
    currency: string;
    percentage: number;
  } | null;
  last_updated: string;
}

// =============================================================================
// HISTORICAL DATA INTERFACES
// =============================================================================

export interface CoinHistoricalData {
  id: string;
  symbol: string;
  name: string;
  description: { [language: string]: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    facebook_username: string;
    bitcointalk_thread_identifier: number | null;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  country_origin: string;
  genesis_date: string | null;
  sentiment_votes_up_percentage: number | null;
  sentiment_votes_down_percentage: number | null;
  market_cap_rank: number | null;
  coingecko_rank: number | null;
  coingecko_score: number | null;
  developer_score: number | null;
  community_score: number | null;
  liquidity_score: number | null;
  public_interest_score: number | null;
  market_data: {
    current_price: { [currency: string]: number };
    market_cap: { [currency: string]: number };
    total_volume: { [currency: string]: number };
  };
  community_data: {
    facebook_likes: number | null;
    twitter_followers: number | null;
    reddit_average_posts_48h: number | null;
    reddit_average_comments_48h: number | null;
    reddit_subscribers: number | null;
    reddit_accounts_active_48h: number | null;
  };
  developer_data: {
    forks: number | null;
    stars: number | null;
    subscribers: number | null;
    total_issues: number | null;
    closed_issues: number | null;
    pull_requests_merged: number | null;
    pull_request_contributors: number | null;
    code_additions_deletions_4_weeks: {
      additions: number | null;
      deletions: number | null;
    };
    commit_count_4_weeks: number | null;
  };
  public_interest_stats: {
    alexa_rank: number | null;
    bing_matches: number | null;
  };
}

// =============================================================================
// TRENDING DATA INTERFACES
// =============================================================================

export interface TrendingCoin {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    small: string;
    large: string;
    slug: string;
    price_btc: number;
    score: number;
  };
}

export interface TrendingNFT {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  nft_contract_id: number;
  native_currency_symbol: string;
  floor_price_in_native_currency: number;
  floor_price_24h_percentage_change: number;
}

export interface TrendingCategory {
  id: number;
  name: string;
  market_cap_1h_change: number;
  slug: string;
  coins_count: number;
}

export interface TrendingCoinsResponse {
  coins: TrendingCoin[];
  nfts: TrendingNFT[];
  categories: TrendingCategory[];
}

// =============================================================================
// GLOBAL MARKET DATA INTERFACES
// =============================================================================

export interface GlobalMarketData {
  data: {
    active_cryptocurrencies: number;
    upcoming_icos: number;
    ongoing_icos: number;
    ended_icos: number;
    markets: number;
    total_market_cap: { [currency: string]: number };
    total_volume: { [currency: string]: number };
    market_cap_percentage: { [currency: string]: number };
    market_cap_change_percentage_24h_usd: number;
    updated_at: number;
  };
}

// =============================================================================
// SEARCH INTERFACES
// =============================================================================

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
  large: string;
}

export interface ExchangeSearchResult {
  id: string;
  name: string;
  market_type: string;
  thumb: string;
  large: string;
}

export interface CategorySearchResult {
  category_id: string;
  name: string;
}

export interface SearchResponse {
  coins: CoinSearchResult[];
  exchanges: ExchangeSearchResult[];
  categories: CategorySearchResult[];
  icos: any[];
  nfts: any[];
}

// =============================================================================
// COIN LIST INTERFACES
// =============================================================================

export interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
  platforms?: { [platform: string]: string };
}

// =============================================================================
// EXCHANGE INTERFACES
// =============================================================================

export interface Exchange {
  id: string;
  name: string;
  year_established: number | null;
  country: string | null;
  description: string;
  url: string;
  image: string;
  has_trading_incentive: boolean;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_btc_normalized: number;
}

export interface ExchangeTicker {
  base: string;
  target: string;
  market: {
    name: string;
    identifier: string;
    has_trading_incentive: boolean;
  };
  last: number;
  volume: number;
  converted_last: { [currency: string]: number };
  converted_volume: { [currency: string]: number };
  trust_score: string;
  bid_ask_spread_percentage: number;
  timestamp: string;
  last_traded_at: string;
  last_fetch_at: string;
  is_anomaly: boolean;
  is_stale: boolean;
  coin_id: string;
  target_coin_id?: string;
}

// =============================================================================
// OHLC (CANDLESTICK) DATA
// =============================================================================

export type OHLCData = [
  number,
  number,
  number,
  number,
  number
];

// =============================================================================
// CHART DATA INTERFACES
// =============================================================================

export interface MarketChartData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// =============================================================================
// PRICE CHANGE INTERFACES
// =============================================================================

export interface PriceChangeData {
  price_change_24h: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d: number;
  price_change_percentage_14d: number;
  price_change_percentage_30d: number;
  price_change_percentage_60d: number;
  price_change_percentage_200d: number;
  price_change_percentage_1y: number;
}

// =============================================================================
// DETAILED COIN DATA INTERFACES
// =============================================================================

export interface DetailedCoinData {
  id: string;
  symbol: string;
  name: string;
  asset_platform_id: string | null;
  platforms: { [platform: string]: string };
  detail_platforms: { [platform: string]: any };
  block_time_in_minutes: number | null;
  hashing_algorithm: string | null;
  categories: string[];
  public_notice: string | null;
  additional_notices: string[];
  description: { [language: string]: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    facebook_username: string;
    bitcointalk_thread_identifier: number | null;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  country_origin: string;
  genesis_date: string | null;
  sentiment_votes_up_percentage: number | null;
  sentiment_votes_down_percentage: number | null;
  watchlist_portfolio_users: number;
  market_cap_rank: number | null;
  coingecko_rank: number | null;
  coingecko_score: number | null;
  developer_score: number | null;
  community_score: number | null;
  liquidity_score: number | null;
  public_interest_score: number | null;
  market_data: {
    current_price: { [currency: string]: number };
    total_value_locked: { [currency: string]: number } | null;
    mcap_to_tvl_ratio: number | null;
    fdv_to_tvl_ratio: number | null;
    roi: { times: number; currency: string; percentage: number } | null;
    ath: { [currency: string]: number };
    ath_change_percentage: { [currency: string]: number };
    ath_date: { [currency: string]: string };
    atl: { [currency: string]: number };
    atl_change_percentage: { [currency: string]: number };
    atl_date: { [currency: string]: string };
    market_cap: { [currency: string]: number };
    market_cap_rank: number | null;
    fully_diluted_valuation: { [currency: string]: number };
    total_volume: { [currency: string]: number };
    high_24h: { [currency: string]: number };
    low_24h: { [currency: string]: number };
    price_change_24h: number;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    price_change_24h_in_currency: { [currency: string]: number };
    price_change_percentage_1h_in_currency: { [currency: string]: number };
    price_change_percentage_24h_in_currency: { [currency: string]: number };
    price_change_percentage_7d_in_currency: { [currency: string]: number };
    price_change_percentage_14d_in_currency: { [currency: string]: number };
    price_change_percentage_30d_in_currency: { [currency: string]: number };
    price_change_percentage_60d_in_currency: { [currency: string]: number };
    price_change_percentage_200d_in_currency: { [currency: string]: number };
    price_change_percentage_1y_in_currency: { [currency: string]: number };
    market_cap_change_24h_in_currency: { [currency: string]: number };
    market_cap_change_percentage_24h_in_currency: { [currency: string]: number };
    total_supply: number | null;
    max_supply: number | null;
    circulating_supply: number;
    last_updated: string;
  };
  community_data: {
    facebook_likes: number | null;
    twitter_followers: number | null;
    reddit_average_posts_48h: number | null;
    reddit_average_comments_48h: number | null;
    reddit_subscribers: number | null;
    reddit_accounts_active_48h: number | null;
    telegram_channel_user_count: number | null;
  };
  developer_data: {
    forks: number | null;
    stars: number | null;
    subscribers: number | null;
    total_issues: number | null;
    closed_issues: number | null;
    pull_requests_merged: number | null;
    pull_request_contributors: number | null;
    code_additions_deletions_4_weeks: {
      additions: number | null;
      deletions: number | null;
    };
    commit_count_4_weeks: number | null;
    last_4_weeks_commit_activity_series: number[];
  };
  public_interest_stats: {
    alexa_rank: number | null;
    bing_matches: number | null;
  };
  status_updates: any[];
  last_updated: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type SupportedCurrency =
  | 'usd' | 'eur' | 'jpy' | 'gbp' | 'aud' | 'cad' | 'chf' | 'cny' | 'sek' | 'nzd'
  | 'mxn' | 'sgd' | 'hkd' | 'nok' | 'php' | 'dkk' | 'pln' | 'ars' | 'inr' | 'brl'
  | 'btc' | 'eth' | 'ltc' | 'bch' | 'bnb' | 'eos' | 'xrp' | 'xlm' | 'link'
  | 'dot' | 'yfi' | 'bits' | 'sats';

export type TimePeriod = '1h' | '24h' | '7d' | '14d' | '30d' | '60d' | '200d' | '1y';

export type MarketOrder =
  | 'market_cap_desc' | 'market_cap_asc' | 'volume_desc' | 'volume_asc'
  | 'id_asc' | 'id_desc' | 'gecko_desc' | 'gecko_asc';

export type PriceChangePercentage =
  | '1h' | '24h' | '7d' | '14d' | '30d' | '60d' | '200d' | '1y';

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface CoinGeckoError {
  error: string;
  status?: {
    error_code: number;
    error_message: string;
  };
}

// =============================================================================
// FUNCTION PARAMETER TYPES
// =============================================================================

export interface GetPriceParams {
  coinIds: string;
  vsCurrencies?: string;
  includeMarketCap?: boolean;
  includeVolume?: boolean;
  includePriceChange?: boolean;
  include24hrChange?: boolean;
  includeLastUpdated?: boolean;
}

export interface GetMarketDataParams {
  vsCurrency?: string;
  perPage?: number;
  page?: number;
  category?: string;
  order?: MarketOrder;
  sparkline?: boolean;
  priceChangePercentage?: PriceChangePercentage[];
}

export interface GetHistoricalDataParams {
  coinId: string;
  date: string;
  localization?: string;
}

export interface GetSearchParams {
  query: string;
}

export interface GetCoinDataParams {
  coinId: string;
  localization?: string;
  tickers?: boolean;
  marketData?: boolean;
  communityData?: boolean;
  developerData?: boolean;
  sparkline?: boolean;
}