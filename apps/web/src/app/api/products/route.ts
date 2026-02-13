import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { devFixtureApplications, devFixtureProducts } from '@/lib/dev-fixtures';
import { products, applications, desc, eq } from '@repo/db';

const authBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  (process.env.AUTH_BYPASS === '1' || process.env.AUTH_BYPASS === 'true')

function safeJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * GET /api/products
 * List all products with their associated applications
 */
export async function GET(request: NextRequest) {
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const includeApps = searchParams.get('includeApps') === 'true';

    let productList;
    try {
      // Fetch all products
      productList = await db
        .select()
        .from(products)
        .orderBy(desc(products.createdAt));
    } catch (err) {
      if (authBypassEnabled) {
        const fixtureProducts = devFixtureProducts.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description ?? null,
          icon: p.icon ?? null,
          color: p.color ?? null,
          status: (p.status ?? 'active') as 'active',
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        }));
        productList = fixtureProducts;
      } else {
        throw err;
      }
    }

    if (!includeApps) {
      return NextResponse.json(safeJson(productList));
    }

    // Fetch products with their applications
    const productsWithApps = await Promise.all(
      productList.map(async (product) => {
        let apps;
        try {
          apps = await db
            .select()
            .from(applications)
            .where(eq(applications.productId, product.id));
        } catch (err) {
          if (authBypassEnabled) {
            apps = devFixtureApplications.filter((a) => a.productId === product.id);
          } else {
            throw err;
          }
        }

        return {
          ...product,
          applications: apps,
          applicationCount: apps.length,
        };
      })
    );

    return NextResponse.json(safeJson(productsWithApps));
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const session = authBypassEnabled ? null : await getServerSession(authOptions);
    if (!authBypassEnabled && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDbAsync();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name if not provided
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check if slug already exists
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A product with this slug already exists' },
        { status: 409 }
      );
    }

    const [newProduct] = await db.insert(products).values({
      name: body.name,
      slug,
      description: body.description || null,
      icon: body.icon || null,
      color: body.color || null,
      status: body.status || 'active',
    }).returning();

    return NextResponse.json(safeJson({
      ...newProduct,
      applications: [],
      applicationCount: 0,
    }), { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
