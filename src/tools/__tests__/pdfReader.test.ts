import { describe, it, expect, vi } from 'vitest';
import { readPdfTool } from '../pfdReader';

// Mock pdf-parse to avoid test file dependency
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({
    text: 'Mock PDF text content for testing purposes.',
    numpages: 1,
    info: {},
  }),
}));

// Mock fs/promises for local file reads
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT: file not found')),
}));

describe('readPdfTool', () => {
  describe('Tool metadata', () => {
    it('should exist and be defined', () => {
      expect(readPdfTool).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(readPdfTool.name).toBe('read_pdf');
    });

    it('should have a description mentioning PDF', () => {
      expect(readPdfTool.description).toContain('PDF');
    });
  });

  describe('Schema validation', () => {
    it('should require source as a string', () => {
      const shape = readPdfTool.schema.shape;
      expect(shape).toHaveProperty('source');
    });

    it('should accept a valid URL as source', () => {
      const result = readPdfTool.schema.safeParse({
        source: 'https://example.com/doc.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('should accept a local file path as source', () => {
      const result = readPdfTool.schema.safeParse({
        source: '/tmp/doc.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional pages array', () => {
      const result = readPdfTool.schema.safeParse({
        source: '/tmp/doc.pdf',
        pages: [1, 3, 5],
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional query string', () => {
      const result = readPdfTool.schema.safeParse({
        source: '/tmp/doc.pdf',
        query: 'keyword',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional contextWindow number', () => {
      const result = readPdfTool.schema.safeParse({
        source: '/tmp/doc.pdf',
        contextWindow: 200,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing source', () => {
      const result = readPdfTool.schema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle network error when fetching from URL', async () => {
      const result = await readPdfTool.invoke({
        source: 'https://example.com/nonexistent.pdf',
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeTruthy();
    });

    it('should handle invalid local file path', async () => {
      const result = await readPdfTool.invoke({
        source: '/nonexistent/file.pdf',
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeTruthy();
    });
  });
});