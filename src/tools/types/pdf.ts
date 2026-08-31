/**
 * PDF Reader TypeScript Interfaces
 */

export interface PdfInputParams {
  source: string;
  pages?: number[];
  query?: string;
  contextWindow?: number;
}

export interface PdfSearchResult {
  page?: number;
  snippet: string;
}

export interface PdfResponse {
  success: boolean;
  text?: string;
  results?: PdfSearchResult[];
  totalPages?: number;
  error?: string;
  message?: string;
}