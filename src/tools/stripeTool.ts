import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil', // Use the latest API version
});

// =============================================================================
// STRIPE ACCOUNT INFO TOOL
// =============================================================================

/**
 * Tool to get basic account information from Stripe
 * This will show account status, capabilities, and general info
 */
const tracedStripeAccountInfoTool = async () => {
    try {
      // Retrieve account information
      const account = await stripe.accounts.retrieve();
      
      // Get account balance
      const balance = await stripe.balance.retrieve();
      
      // Format the response with account details
      let result = `=� **Stripe Account Information**\n\n`;
      
      // Basic account info
      result += `<� **Account Details:**\n`;
      result += `   " Account ID: ${account.id}\n`;
      result += `   " Business Type: ${account.business_type || 'Not specified'}\n`;
      result += `   " Country: ${account.country}\n`;
      result += `   " Email: ${account.email || 'Not specified'}\n`;
      result += `   " Created: ${account.created ? new Date(account.created * 1000).toLocaleDateString() : 'N/A'}\n`;
      result += `   " Charges Enabled: ${account.charges_enabled ? '' : 'L'}\n`;
      result += `   " Payouts Enabled: ${account.payouts_enabled ? '' : 'L'}\n\n`;
      
      // Account balance information
      result += `=� **Account Balance:**\n`;
      balance.available.forEach(bal => {
        const amount = (bal.amount / 100).toFixed(2); // Convert from cents
        result += `   " Available: ${amount} ${bal.currency.toUpperCase()}\n`;
      });
      
      balance.pending.forEach(bal => {
        const amount = (bal.amount / 100).toFixed(2); // Convert from cents
        result += `   " Pending: ${amount} ${bal.currency.toUpperCase()}\n`;
      });
      
      return result;
      
    } catch (error) {
      console.error('Stripe Account Info Error:', error);
      if (error instanceof Stripe.errors.StripeError) {
        return `L Stripe Error: ${error.message}`;
      }
      return `L Error retrieving account information: ${error}`;
    }
  };

export const stripeAccountInfoTool = tool(tracedStripeAccountInfoTool, {
  name: "stripeAccountInfo",
  description: "Get basic information about your Stripe account including balance, status, and capabilities",
  schema: z.object({}), // No parameters needed
});

// =============================================================================
// STRIPE CUSTOMERS LIST TOOL
// =============================================================================

/**
 * Tool to list customers in your Stripe account
 * Shows customer count and basic customer information
 */
const tracedStripeCustomersListTool = async ({ limit }: { limit?: number }) => {
    try {
      const customerLimit = Math.min(limit || 10, 100); // Limit to max 100 customers
      
      // Retrieve customers list
      const customers = await stripe.customers.list({
        limit: customerLimit,
      });
      
      let result = `=e **Stripe Customers**\n\n`;
      result += `=� Total customers shown: ${customers.data.length}\n`;
      result += `= Has more customers: ${customers.has_more ? 'Yes' : 'No'}\n\n`;
      
      if (customers.data.length === 0) {
        result += `=� No customers found in your account yet.\n`;
        result += `=� Customers will appear here when you create them or when they make purchases.\n`;
        return result;
      }
      
      // Display customer details
      result += `**Customer List:**\n`;
      customers.data.forEach((customer, index) => {
        result += `\n${index + 1}. **${customer.name || customer.email || 'Unnamed Customer'}**\n`;
        result += `   " ID: ${customer.id}\n`;
        result += `   " Email: ${customer.email || 'No email'}\n`;
        result += `   " Created: ${new Date(customer.created * 1000).toLocaleDateString()}\n`;
        result += `   " Active: ${customer.livemode ? 'Live' : 'Test'}\n`;
        
        // Show metadata if available
        if (Object.keys(customer.metadata).length > 0) {
          result += `   " Metadata: ${JSON.stringify(customer.metadata)}\n`;
        }
      });
      
      return result;
      
    } catch (error) {
      console.error('Stripe Customers List Error:', error);
      if (error instanceof Stripe.errors.StripeError) {
        return `L Stripe Error: ${error.message}`;
      }
      return `L Error retrieving customers: ${error}`;
    }
  };

export const stripeCustomersListTool = tool(tracedStripeCustomersListTool, {
  name: "stripeCustomersList",
  description: "List customers in your Stripe account with basic information",
  schema: z.object({
    limit: z.number().min(1).max(100).optional().describe("Number of customers to retrieve (max 100, default 10)")
  }),
});

// =============================================================================
// STRIPE CREATE CUSTOMER TOOL
// =============================================================================

/**
 * Tool to create a new customer in Stripe
 * Useful for testing and managing customer data
 */
const tracedStripeCreateCustomerTool = async ({ email, name, description }: { email: string; name?: string; description?: string }) => {
    try {
      // Create customer parameters
      const customerParams: Stripe.CustomerCreateParams = {
        email,
      };
      
      // Add optional parameters
      if (name) customerParams.name = name;
      if (description) customerParams.description = description;
      
      // Create the customer
      const customer = await stripe.customers.create(customerParams);
      
      let result = ` **Customer Created Successfully**\n\n`;
      result += `=d **Customer Details:**\n`;
      result += `   " ID: ${customer.id}\n`;
      result += `   " Email: ${customer.email}\n`;
      result += `   " Name: ${customer.name || 'Not provided'}\n`;
      result += `   " Description: ${customer.description || 'Not provided'}\n`;
      result += `   " Created: ${new Date(customer.created * 1000).toLocaleString()}\n`;
      result += `   " Mode: ${customer.livemode ? 'Live' : 'Test'}\n`;
      
      return result;
      
    } catch (error) {
      console.error('Stripe Create Customer Error:', error);
      if (error instanceof Stripe.errors.StripeError) {
        return `L Stripe Error: ${error.message}`;
      }
      return `L Error creating customer: ${error}`;
    }
  };

export const stripeCreateCustomerTool = tool(tracedStripeCreateCustomerTool, {
  name: "stripeCreateCustomer",
  description: "Create a new customer in your Stripe account",
  schema: z.object({
    email: z.string().email().describe("Customer's email address (required)"),
    name: z.string().optional().describe("Customer's full name (optional)"),
    description: z.string().optional().describe("Description or notes about the customer (optional)")
  }),
});

// =============================================================================
// STRIPE RECENT EVENTS TOOL
// =============================================================================

/**
 * Tool to get recent events/activity from your Stripe account
 * Shows recent API calls and account activity
 */
const tracedStripeRecentEventsTool = async ({ limit }: { limit?: number }) => {
    try {
      const eventLimit = Math.min(limit || 5, 20); // Limit to max 20 events
      
      // Retrieve recent events
      const events = await stripe.events.list({
        limit: eventLimit,
      });
      
      let result = `=� **Recent Stripe Events**\n\n`;
      result += `=� Events shown: ${events.data.length}\n\n`;
      
      if (events.data.length === 0) {
        result += `=� No recent events found.\n`;
        result += `=� Events will appear here as you use your Stripe account.\n`;
        return result;
      }
      
      // Display event details
      events.data.forEach((event, index) => {
        result += `${index + 1}. **${event.type}**\n`;
        result += `   " ID: ${event.id}\n`;
        result += `   " Created: ${new Date(event.created * 1000).toLocaleString()}\n`;
        result += `   " Mode: ${event.livemode ? 'Live' : 'Test'}\n`;
        
        // Show object type if available
        if (event.data?.object) {
          result += `   " Object: ${event.data.object.object}\n`;
        }
        result += `\n`;
      });
      
      return result;
      
    } catch (error) {
      console.error('Stripe Recent Events Error:', error);
      if (error instanceof Stripe.errors.StripeError) {
        return `L Stripe Error: ${error.message}`;
      }
      return `L Error retrieving recent events: ${error}`;
    }
  };

export const stripeRecentEventsTool = tool(tracedStripeRecentEventsTool, {
  name: "stripeRecentEvents",
  description: "Get recent events and activity from your Stripe account",
  schema: z.object({
    limit: z.number().min(1).max(20).optional().describe("Number of recent events to retrieve (max 20, default 5)")
  }),
});

// =============================================================================
// EXPORT ALL STRIPE TOOLS
// =============================================================================

export const ALL_STRIPE_TOOLS = [
  stripeAccountInfoTool,
  stripeCustomersListTool,
  stripeCreateCustomerTool,
  stripeRecentEventsTool,
];