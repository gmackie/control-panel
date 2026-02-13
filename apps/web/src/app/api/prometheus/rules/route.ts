import { NextRequest, NextResponse } from 'next/server';
import { prometheusRuleClient } from '@/lib/prometheus/prometheus-client';

/**
 * GET /api/prometheus/rules
 * List all PrometheusRule CRDs in the monitoring namespace
 */
export async function GET() {
  try {
    const rules = await prometheusRuleClient.listRules();
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error listing Prometheus rules:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Prometheus rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prometheus/rules
 * Create a new PrometheusRule CRD
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.metadata?.name || !body.spec?.groups) {
      return NextResponse.json(
        { error: 'Missing required fields: metadata.name and spec.groups' },
        { status: 400 }
      );
    }

    const rule = await prometheusRuleClient.createRule(body);
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating Prometheus rule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Prometheus rule' },
      { status: 500 }
    );
  }
}
