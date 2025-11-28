import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg';

interface ProductDetail {
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
  date_created: string | null;
  date_updated: string | null;
}

interface ProductImage {
  id: number;
  url: string;
  is_main: boolean;
  position: number | null;
  width: number | null;
  height: number | null;
}

interface ProductAttribute {
  attribute_name: string;
  attribute_value: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return NextResponse.json(
      { error: 'Invalid product ID' },
      { status: 400 }
    );
  }

  try {
    // Get product details
    const productResult = await query<ProductDetail>(`
      SELECT
        id,
        name,
        sku,
        slug,
        active,
        manufacturer_name,
        price,
        sale_price,
        sale,
        description,
        novinki,
        gender,
        category_airtable,
        date_created,
        date_updated
      FROM products
      WHERE id = $1
    `, [productId]);

    if (productResult.length === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const product = productResult[0];

    // Get all images ordered by position (main first, then by position)
    const images = await query<ProductImage>(`
      SELECT
        id,
        url,
        is_main,
        position,
        width,
        height
      FROM product_images
      WHERE product_id = $1
      ORDER BY is_main DESC, position ASC NULLS LAST, id ASC
    `, [productId]);

    // Get relevant attributes (exclude technical/internal ones)
    const excludedAttributes = [
      'cover_image_number',
      'facebook_hidden_image',
      'display_priority',
      'swell_id',
      'import_id',
      'sync_status',
    ];
    const attributes = await query<ProductAttribute>(`
      SELECT
        attribute_name,
        attribute_value
      FROM product_attributes
      WHERE product_id = $1
        AND attribute_name NOT IN (${excludedAttributes.map((_, i) => `$${i + 2}`).join(', ')})
      ORDER BY attribute_name
    `, [productId, ...excludedAttributes]);

    return NextResponse.json({
      product,
      images,
      attributes,
    });
  } catch (error) {
    console.error('Product detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product details' },
      { status: 500 }
    );
  }
}
