import { describe, it, expect } from 'vitest';
import { randomNumberTool } from '../randomNumberTool';

describe('randomNumberTool', () => {
  describe('Tool metadata', () => {
    it('should exist and be defined', () => {
      expect(randomNumberTool).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(randomNumberTool.name).toBe('randomNumberTool');
    });

    it('should have a description explaining its purpose', () => {
      expect(randomNumberTool.description).toBeTruthy();
      expect(randomNumberTool.description.toLowerCase()).toContain('random');
    });

    it('should have a schema with min and max properties', () => {
      const schema = randomNumberTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('min');
      expect(schema.shape).toHaveProperty('max');
    });
  });

  describe('Invocation within valid range', () => {
    it('should return a number within the specified range (min=1, max=100)', async () => {
      const result = await randomNumberTool.invoke({ min: 1, max: 100 });
      const num = parseInt(result, 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(100);
    });

    it('should return a number within negative range (min=-50, max=-1)', async () => {
      const result = await randomNumberTool.invoke({ min: -50, max: -1 });
      const num = parseInt(result, 10);
      expect(num).toBeGreaterThanOrEqual(-50);
      expect(num).toBeLessThanOrEqual(-1);
    });

    it('should return a number as a string', async () => {
      const result = await randomNumberTool.invoke({ min: 0, max: 10 });
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+$/);
    });
  });

  describe('Boundary conditions', () => {
    it('should return the exact value when min equals max', async () => {
      const result = await randomNumberTool.invoke({ min: 42, max: 42 });
      expect(result).toBe('42');
    });

    it('should include both min and max in the range', async () => {
      // Run multiple times to verify boundaries are inclusive
      for (let i = 0; i < 50; i++) {
        const result = await randomNumberTool.invoke({ min: 0, max: 2 });
        const num = parseInt(result, 10);
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Error handling', () => {
    it('should throw an error when min > max', async () => {
      await expect(randomNumberTool.invoke({ min: 100, max: 1 })).rejects.toThrow();
    });

    it('should throw an error with a descriptive message when min > max', async () => {
      try {
        await randomNumberTool.invoke({ min: 100, max: 1 });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toMatch(/invalid range|min must be less/i);
      }
    });
  });

  describe('Output randomness', () => {
    it('should produce varying results across multiple invocations', async () => {
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = await randomNumberTool.invoke({ min: 1, max: 20 });
        results.add(result);
      }
      // Expect at least 2 different values (very high probability)
      expect(results.size).toBeGreaterThan(1);
    });
  });
});