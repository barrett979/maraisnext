import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg';
import { cache, CACHE_KEYS, DEFAULT_TTL } from '@/lib/cache';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  slug: string | null;
  active: boolean;
  manufacturer_name: string | null;
  price: string | null;
  sale_price: string | null;
  sale: boolean;
  description: string | null;
  novinki: boolean;
  gender: string | null;
  category_airtable: string | null;
  season: string | null;
  main_image: string | null;
  date_created: string | null;
  date_updated: string | null;
}

interface BrandRow {
  manufacturer_name: string;
}

interface CategoryRow {
  category_airtable: string;
}

interface SeasonRow {
  attribute_value: string;
}

interface ColorRow {
  attribute_value: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Pagination
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Search
  const search = searchParams.get('search') || '';

  // Filters
  const brand = searchParams.get('brand') || '';
  const gender = searchParams.get('gender') || '';
  const active = searchParams.get('active') || '';
  const novinki = searchParams.get('novinki') || '';
  const category = searchParams.get('category') || '';
  const season = searchParams.get('season') || '';
  const color = searchParams.get('color') || '';

  // Sorting
  const sortBy = searchParams.get('sortBy') || 'date_updated';
  const sortDir = searchParams.get('sortDir') || 'desc';

  // Build query
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Search in name, sku, description
  if (search) {
    conditions.push(`(
      p.name ILIKE $${paramIndex} OR
      p.sku ILIKE $${paramIndex} OR
      p.description ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Brand filter
  if (brand) {
    conditions.push(`p.manufacturer_name = $${paramIndex}`);
    params.push(brand);
    paramIndex++;
  }

  // Gender filter
  if (gender) {
    conditions.push(`p.gender = $${paramIndex}`);
    params.push(gender);
    paramIndex++;
  }

  // Active filter
  if (active === 'true') {
    conditions.push(`p.active = true`);
  } else if (active === 'false') {
    conditions.push(`p.active = false`);
  }

  // Novinki filter
  if (novinki === 'true') {
    conditions.push(`p.novinki = true`);
  } else if (novinki === 'false') {
    conditions.push(`p.novinki = false`);
  }

  // Category filter
  if (category) {
    conditions.push(`p.category_airtable = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  // Season filter (from product_attributes table)
  if (season) {
    conditions.push(`EXISTS (SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_name = 'season' AND pa.attribute_value = $${paramIndex})`);
    params.push(season);
    paramIndex++;
  }

  // Color filter (from product_attributes table)
  if (color) {
    conditions.push(`EXISTS (SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_name = 'color' AND pa.attribute_value = $${paramIndex})`);
    params.push(color);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort column
  const allowedSortColumns = ['name', 'sku', 'manufacturer_name', 'price', 'sale_price', 'date_created', 'date_updated', 'active', 'novinki'];
  const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'date_updated';
  const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC';

  try {
    // Get products with main image
    const productsQuery = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.slug,
        p.active,
        p.manufacturer_name,
        p.price,
        p.sale_price,
        p.sale,
        p.description,
        p.novinki,
        p.gender,
        p.category_airtable,
        p.date_created,
        p.date_updated,
        (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image,
        (SELECT pa.attribute_value FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_name = 'season' LIMIT 1) as season
      FROM products p
      ${whereClause}
      ORDER BY p.${sortColumn} ${sortDirection} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const products = await query<Product>(productsQuery, [...params, limit, offset]);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
    const countResult = await query<{ total: string }>(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0');

    // Get filter options with caching (5 min TTL)
    const brands = await cache.getOrSet<BrandRow[]>(
      CACHE_KEYS.PRODUCT_BRANDS,
      () => query<BrandRow>(`
        SELECT DISTINCT manufacturer_name
        FROM products
        WHERE manufacturer_name IS NOT NULL AND manufacturer_name != ''
        ORDER BY manufacturer_name
      `),
      DEFAULT_TTL
    );

    const categories = await cache.getOrSet<CategoryRow[]>(
      CACHE_KEYS.PRODUCT_CATEGORIES,
      () => query<CategoryRow>(`
        SELECT DISTINCT category_airtable
        FROM products
        WHERE category_airtable IS NOT NULL AND category_airtable != ''
        ORDER BY category_airtable
      `),
      DEFAULT_TTL
    );

    const seasons = await cache.getOrSet<SeasonRow[]>(
      CACHE_KEYS.PRODUCT_SEASONS,
      () => query<SeasonRow>(`
        SELECT DISTINCT attribute_value
        FROM product_attributes
        WHERE attribute_name = 'season' AND attribute_value IS NOT NULL AND attribute_value != ''
        ORDER BY attribute_value
      `),
      DEFAULT_TTL
    );

    const colors = await cache.getOrSet<ColorRow[]>(
      CACHE_KEYS.PRODUCT_COLORS,
      () => query<ColorRow>(`
        SELECT DISTINCT attribute_value
        FROM product_attributes
        WHERE attribute_name = 'color' AND attribute_value IS NOT NULL AND attribute_value != ''
        ORDER BY attribute_value
      `),
      DEFAULT_TTL
    );

    return NextResponse.json({
      products,
      total,
      limit,
      offset,
      brands: brands.map(b => b.manufacturer_name),
      categories: categories.map(c => c.category_airtable),
      seasons: seasons.map(s => s.attribute_value),
      colors: colors.map(c => c.attribute_value),
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
