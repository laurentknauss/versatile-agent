import { describe, it, expect } from 'vitest';
import {
  stripeAccountInfoTool,
  stripeCustomersListTool,
  stripeCreateCustomerTool,
  stripeRecentEventsTool,
  ALL_STRIPE_TOOLS,
} from '../stripeTool';

describe('Stripe tools', () => {
  describe('Tool metadata', () => {
    it('should export ALL_STRIPE_TOOLS array with 4 tools', () => {
      expect(ALL_STRIPE_TOOLS).toBeDefined();
      expect(ALL_STRIPE_TOOLS.length).toBe(4);
    });

    it('stripeAccountInfoTool should have correct name', () => {
      expect(stripeAccountInfoTool.name).toBe('stripeAccountInfo');
    });

    it('stripeCustomersListTool should have correct name', () => {
      expect(stripeCustomersListTool.name).toBe('stripeCustomersList');
    });

    it('stripeCreateCustomerTool should have correct name', () => {
      expect(stripeCreateCustomerTool.name).toBe('stripeCreateCustomer');
    });

    it('stripeRecentEventsTool should have correct name', () => {
      expect(stripeRecentEventsTool.name).toBe('stripeRecentEvents');
    });
  });

  describe('Account info tool', () => {
    it('should have an empty schema (no params)', () => {
      const shape = stripeAccountInfoTool.schema.shape;
      expect(Object.keys(shape).length).toBe(0);
    });
  });

  describe('Customers list tool schema', () => {
    it('should accept limit as optional parameter', () => {
      const shape = stripeCustomersListTool.schema.shape;
      expect(shape).toHaveProperty('limit');
    });

    it('should validate limit within 1-100 range', () => {
      const valid = stripeCustomersListTool.schema.safeParse({ limit: 50 });
      expect(valid.success).toBe(true);
    });

    it('should reject limit greater than 100', () => {
      const invalid = stripeCustomersListTool.schema.safeParse({ limit: 200 });
      expect(invalid.success).toBe(false);
    });

    it('should accept empty params (default limit=10)', () => {
      const valid = stripeCustomersListTool.schema.safeParse({});
      expect(valid.success).toBe(true);
    });
  });

  describe('Create customer tool schema', () => {
    it('should require email', () => {
      const shape = stripeCreateCustomerTool.schema.shape;
      expect(shape).toHaveProperty('email');
    });

    it('should validate email format', () => {
      const valid = stripeCreateCustomerTool.schema.safeParse({ email: 'test@example.com' });
      expect(valid.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalid = stripeCreateCustomerTool.schema.safeParse({ email: 'not-an-email' });
      expect(invalid.success).toBe(false);
    });

    it('should reject missing email', () => {
      const invalid = stripeCreateCustomerTool.schema.safeParse({});
      expect(invalid.success).toBe(false);
    });

    it('should accept optional name', () => {
      const valid = stripeCreateCustomerTool.schema.safeParse({
        email: 'john@example.com',
        name: 'John Doe',
      });
      expect(valid.success).toBe(true);
    });

    it('should accept optional description', () => {
      const valid = stripeCreateCustomerTool.schema.safeParse({
        email: 'john@example.com',
        description: 'Test customer',
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('Recent events tool schema', () => {
    it('should accept limit as optional parameter', () => {
      const shape = stripeRecentEventsTool.schema.shape;
      expect(shape).toHaveProperty('limit');
    });

    it('should validate limit within 1-20 range', () => {
      const valid = stripeRecentEventsTool.schema.safeParse({ limit: 10 });
      expect(valid.success).toBe(true);
    });

    it('should reject limit greater than 20', () => {
      const invalid = stripeRecentEventsTool.schema.safeParse({ limit: 50 });
      expect(invalid.success).toBe(false);
    });
  });
});