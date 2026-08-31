import { describe, it, expect } from 'vitest';
import { ALL_TOOLS_LIST, additionTool, currentTimeTool } from '../tools';
import { randomNumberTool } from '../randomNumberTool';

describe('ALL_TOOLS_LIST', () => {
  it('should be defined and be an array', () => {
    expect(ALL_TOOLS_LIST).toBeDefined();
    expect(Array.isArray(ALL_TOOLS_LIST)).toBe(true);
  });

  it('should contain at least 8 tools', () => {
    expect(ALL_TOOLS_LIST.length).toBeGreaterThanOrEqual(8);
  });

  it('should contain unique tool names', () => {
    const names = ALL_TOOLS_LIST.map(tool => tool.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('every tool should have a name, description, and schema', () => {
    ALL_TOOLS_LIST.forEach(tool => {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      expect(tool.schema).toBeDefined();
      expect(tool.schema.shape).toBeDefined();
    });
  });

  it('should include the addition tool', () => {
    const name = 'additionTool';
    expect(ALL_TOOLS_LIST.some(t => t.name === name)).toBe(true);
  });

  it('should include the current time tool', () => {
    expect(ALL_TOOLS_LIST.some(t => t.name === 'currentTime')).toBe(true);
  });

  it('should include both coinGecko tools', () => {
    const names = ALL_TOOLS_LIST.map(t => t.name);
    expect(names).toContain('coinGeckoPrice');
    expect(names).toContain('coinGeckoMarket');
  });

  it('should include the weather tool', () => {
    const names = ALL_TOOLS_LIST.map(t => t.name);
    expect(names).toContain('openWeatherMap');
  });

  it('should include Stripe tools', () => {
    const names = ALL_TOOLS_LIST.map(t => t.name);
    const stripeTools = names.filter(n => n.toLowerCase().startsWith('stripe'));
    expect(stripeTools.length).toBeGreaterThanOrEqual(1);
  });
});

describe('additionTool', () => {
  it('should exist and have the correct name', () => {
    expect(additionTool).toBeDefined();
    expect(additionTool.name).toBe('additionTool');
  });

  it('should add two positive numbers correctly', async () => {
    const result = await additionTool.invoke({ a: 5, b: 3 });
    expect(result).toBe('8');
  });

  it('should handle negative numbers', async () => {
    const result = await additionTool.invoke({ a: -5, b: 10 });
    expect(result).toBe('5');
  });

  it('should handle zero values', async () => {
    const result = await additionTool.invoke({ a: 0, b: 0 });
    expect(result).toBe('0');
  });

  it('should handle decimal numbers', async () => {
    const result = await additionTool.invoke({ a: 1.5, b: 2.5 });
    expect(result).toBe('4');
  });

  it('should return the result as a string', async () => {
    const result = await additionTool.invoke({ a: 100, b: 200 });
    expect(typeof result).toBe('string');
  });
});

describe('currentTimeTool', () => {
  it('should exist and have the correct name', () => {
    expect(currentTimeTool).toBeDefined();
    expect(currentTimeTool.name).toBe('currentTime');
  });

  it('should return a string in HH:MM:SS format', async () => {
    const result = await currentTimeTool.invoke({});
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should return the current hour within valid range', async () => {
    const result = await currentTimeTool.invoke({});
    const hour = parseInt(result.substring(0, 2), 10);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });

  it('should return valid minutes within 0-59', async () => {
    const result = await currentTimeTool.invoke({});
    const minutes = parseInt(result.substring(3, 5), 10);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
  });

  it('should return valid seconds within 0-59', async () => {
    const result = await currentTimeTool.invoke({});
    const seconds = parseInt(result.substring(6, 8), 10);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });
});