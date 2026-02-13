import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { prometheusRuleClient } from '@/lib/prometheus/prometheus-client';

interface Params {
  params: Promise<{
    name: string;
  }>;
}

/**
 * GET /api/prometheus/rules/[name]
 * Get a specific PrometheusRule CRD by name
 */
export async function GET(_request: NextRequest, props: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { name } = await props.params;
  try {
    const rule = await prometheusRuleClient.getRule(name);
    return NextResponse.json(rule);
  } catch (error) {
    console.error(`Error fetching Prometheus rule '${name}':`, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch Prometheus rule';
    const status = message.includes('404') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PUT /api/prometheus/rules/[name]
 * Update an existing PrometheusRule CRD
 */
export async function PUT(request: NextRequest, props: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { name } = await props.params;
  try {
    const body = await request.json();

    if (!body.spec?.groups) {
      return NextResponse.json(
        { error: 'Missing required field: spec.groups' },
        { status: 400 }
      );
    }

    const rule = await prometheusRuleClient.updateRule(name, body);
    return NextResponse.json(rule);
  } catch (error) {
    console.error(`Error updating Prometheus rule '${name}':`, error);
    const message = error instanceof Error ? error.message : 'Failed to update Prometheus rule';
    const status = message.includes('404') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/prometheus/rules/[name]
 * Delete a PrometheusRule CRD
 */
export async function DELETE(_request: NextRequest, props: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { name } = await props.params;
  try {
    await prometheusRuleClient.deleteRule(name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting Prometheus rule '${name}':`, error);
    const message = error instanceof Error ? error.message : 'Failed to delete Prometheus rule';
    const status = message.includes('404') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
