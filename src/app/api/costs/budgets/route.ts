import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { costManager } from '@/lib/cost-tracking/cost-manager';
import { z } from 'zod';

const CreateBudgetSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  period: z.enum(['monthly', 'quarterly', 'yearly']),
  categories: z.array(z.enum(['compute', 'storage', 'network', 'database', 'monitoring', 'backup', 'other'])).optional(),
  providers: z.array(z.enum(['hetzner', 'aws', 'gcp', 'azure', 'other'])).optional(),
  applications: z.array(z.string()).optional(),
  alertThresholds: z.array(z.object({
    percentage: z.number().min(1).max(100),
    channels: z.array(z.enum(['email', 'slack', 'webhook', 'sms', 'pagerduty']))
  })).default([
    { percentage: 80, channels: ['email'] },
    { percentage: 95, channels: ['email', 'slack'] }
  ]),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});

// GET /api/costs/budgets - Get all budgets with status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeAnalytics = searchParams.get('analytics') === 'true';
    const status = searchParams.get('status'); // 'under', 'warning', 'over'

    let budgets = costManager.getBudgets();

    // Filter by status if requested
    if (status) {
      budgets = budgets.filter(budget => {
        // Mock status based on budget usage
        const usage = Math.random() * 100;
        const budgetStatus = usage > 90 ? 'over' : usage > 70 ? 'warning' : 'under';
        return budgetStatus === status;
      });
    }

    const response: any = {
      success: true,
      budgets,
      total: budgets.length,
      lastUpdated: new Date().toISOString()
    };

    if (includeAnalytics) {
      const analytics = {
        totalBudget: budgets.reduce((sum, b) => sum + b.amount, 0),
        totalSpent: budgets.reduce((sum, b) => sum + (b.amount * Math.random() * 0.8), 0),
        byStatus: {
          under: Math.floor(budgets.length * 0.6),
          warning: Math.floor(budgets.length * 0.3),
          over: Math.floor(budgets.length * 0.1),
        },
        averageUtilization: Math.random() * 80,
        criticalBudgets: []
      };
      response.analytics = analytics;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch budgets' },
      { status: 500 }
    );
  }
}

// POST /api/costs/budgets - Create a new budget
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const budgetData = CreateBudgetSchema.parse(body);

    // Mock create budget implementation
    const budget = {
      id: Math.random().toString(36).substring(7),
      ...budgetData,
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json({
      success: true,
      budget,
      message: 'Budget created successfully'
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid budget data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating budget:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create budget' },
      { status: 500 }
    );
  }
}

// PUT /api/costs/budgets - Update multiple budgets
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { budgets } = body;

    if (!Array.isArray(budgets)) {
      return NextResponse.json(
        { success: false, error: 'Expected array of budgets' },
        { status: 400 }
      );
    }

    const updatedBudgets = [];
    const errors = [];

    for (const budgetData of budgets) {
      try {
        // Mock batch update budget implementation
        const budget = {
          ...budgetData,
          updatedAt: new Date(),
        };
        if (budget) {
          updatedBudgets.push(budget);
        } else {
          errors.push({ id: budgetData.id, error: 'Budget not found' });
        }
      } catch (error) {
        errors.push({ id: budgetData.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated: updatedBudgets,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${updatedBudgets.length} budgets${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    });
  } catch (error) {
    console.error('Error updating budgets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update budgets' },
      { status: 500 }
    );
  }
}