import { StripeMetrics } from "@/types";

export async function getStripeMetrics(): Promise<StripeMetrics> {
  // In production, this would connect to Stripe API
  // For now, return realistic mock data that matches our business
  
  return {
    mrr: 48750,
    arr: 585000,
    newCustomers: 18,
    churnedCustomers: 3,
    revenue: {
      today: 2150,
      month: 48750,
      year: 523400,
    },
    topPlans: [
      { name: 'Pro', customers: 156, revenue: 31200 },
      { name: 'Business', customers: 42, revenue: 12600 },
      { name: 'Starter', customers: 234, revenue: 4950 },
    ],
  };
}