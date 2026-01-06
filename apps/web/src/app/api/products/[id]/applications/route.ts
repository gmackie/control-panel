import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { products, applications, eq } from '@repo/db';

function safeJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.productId, id));

    return NextResponse.json(safeJson(apps));
  } catch (error) {
    console.error('Error fetching product applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!body.applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 }
      );
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, body.applicationId))
      .limit(1);

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(applications)
      .set({
        productId: id,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, body.applicationId))
      .returning();

    return NextResponse.json(safeJson(updated));
  } catch (error) {
    console.error('Error adding application to product:', error);
    return NextResponse.json(
      { error: 'Failed to add application', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');

    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId query parameter is required' },
        { status: 400 }
      );
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (app.productId !== id) {
      return NextResponse.json(
        { error: 'Application does not belong to this product' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(applications)
      .set({
        productId: null,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId))
      .returning();

    return NextResponse.json(safeJson(updated));
  } catch (error) {
    console.error('Error removing application from product:', error);
    return NextResponse.json(
      { error: 'Failed to remove application', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
