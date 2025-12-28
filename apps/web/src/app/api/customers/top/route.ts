import { NextRequest, NextResponse } from "next/server";
import { getAllCustomers } from "@/lib/db-utils";

export async function GET(request: NextRequest) {
  try {
    const customers = await getAllCustomers();

    // For now, return mock data until we have real customer data
    // In production, this would fetch from the database
    const mockCustomers = [
      {
        id: "cust_1",
        email: "john@acmecorp.com",
        name: "John Smith",
        company: "Acme Corp",
        createdAt: "2023-01-15T00:00:00Z",
        subscription: {
          plan: "Business",
          status: "active",
          currentPeriodEnd: "2024-02-15T00:00:00Z",
          mrr: 499,
        },
        usage: {
          apiCalls: 1234567,
          dataProcessed: 53687091200, // 50GB
          activeUsers: 45,
        },
        lifetime: {
          revenue: 5988,
          costs: 1200,
          profit: 4788,
        },
      },
      {
        id: "cust_2",
        email: "sarah@techstart.io",
        name: "Sarah Johnson",
        company: "TechStart Inc",
        createdAt: "2023-03-20T00:00:00Z",
        subscription: {
          plan: "Pro",
          status: "active",
          currentPeriodEnd: "2024-02-20T00:00:00Z",
          mrr: 299,
        },
        usage: {
          apiCalls: 876543,
          dataProcessed: 32212254720, // 30GB
          activeUsers: 32,
        },
        lifetime: {
          revenue: 3289,
          costs: 800,
          profit: 2489,
        },
      },
      {
        id: "cust_3",
        email: "mike@cloudscale.com",
        name: "Mike Chen",
        company: "CloudScale",
        createdAt: "2023-02-10T00:00:00Z",
        subscription: {
          plan: "Business",
          status: "active",
          currentPeriodEnd: "2024-02-10T00:00:00Z",
          mrr: 499,
        },
        usage: {
          apiCalls: 2345678,
          dataProcessed: 107374182400, // 100GB
          activeUsers: 28,
        },
        lifetime: {
          revenue: 5489,
          costs: 1500,
          profit: 3989,
        },
      },
      {
        id: "cust_4",
        email: "emma@dataflow.systems",
        name: "Emma Davis",
        company: "DataFlow Systems",
        createdAt: "2023-04-05T00:00:00Z",
        subscription: {
          plan: "Pro",
          status: "active",
          currentPeriodEnd: "2024-02-05T00:00:00Z",
          mrr: 299,
        },
        usage: {
          apiCalls: 567890,
          dataProcessed: 21474836480, // 20GB
          activeUsers: 23,
        },
        lifetime: {
          revenue: 2691,
          costs: 600,
          profit: 2091,
        },
      },
      {
        id: "cust_5",
        email: "alex@nextgen.solutions",
        name: "Alex Thompson",
        company: "NextGen Solutions",
        createdAt: "2023-05-12T00:00:00Z",
        subscription: {
          plan: "Starter",
          status: "active",
          currentPeriodEnd: "2024-02-12T00:00:00Z",
          mrr: 99,
        },
        usage: {
          apiCalls: 234567,
          dataProcessed: 10737418240, // 10GB
          activeUsers: 21,
        },
        lifetime: {
          revenue: 891,
          costs: 200,
          profit: 691,
        },
      },
    ];

    return NextResponse.json(mockCustomers);
  } catch (error) {
    console.error("Failed to fetch top customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch top customers" },
      { status: 500 }
    );
  }
}
