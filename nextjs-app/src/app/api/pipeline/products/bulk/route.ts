import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDgAaPpN2ZNh0Cx';
const PRODUCTS_TABLE_ID = 'tblXXXXXXXXXXXXXX'; // TODO: Replace with actual table ID

interface ProductRecord {
  id: number;
  airtable_id: string;
  status: string | null;
}

// Update status of multiple products
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productIds, status } = body;

    // Validate
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const validStatuses = ['waiting', 'ready', 'canceled', 'in stock', 'shipped'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getMetadataDb();

    // Get products to find airtable_ids
    const placeholders = productIds.map(() => '?').join(',');
    const products = db.prepare(`
      SELECT id, airtable_id, status
      FROM pipeline_products
      WHERE id IN (${placeholders})
    `).all(...productIds) as ProductRecord[];

    if (products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 });
    }

    // Update Airtable first (batch update)
    if (AIRTABLE_API_KEY && PRODUCTS_TABLE_ID !== 'tblXXXXXXXXXXXXXX') {
      const airtableRecords = products.map(p => ({
        id: p.airtable_id,
        fields: { status },
      }));

      // Airtable batch update supports max 10 records per request
      const chunks = [];
      for (let i = 0; i < airtableRecords.length; i += 10) {
        chunks.push(airtableRecords.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${PRODUCTS_TABLE_ID}`;
        const airtableResponse = await fetch(airtableUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: chunk }),
        });

        if (!airtableResponse.ok) {
          const errorText = await airtableResponse.text();
          console.error('Airtable batch update failed:', errorText);
          // Continue with local update even if Airtable fails
        }
      }
    }

    // Update local SQLite database
    db.prepare(`
      UPDATE pipeline_products
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(status, ...productIds);

    return NextResponse.json({
      success: true,
      updated: products.length,
    });
  } catch (error) {
    console.error('Error updating products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete multiple products
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productIds } = body;

    // Validate
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const db = getMetadataDb();

    // Get products to verify they exist and are in 'waiting' status
    const placeholders = productIds.map(() => '?').join(',');
    const products = db.prepare(`
      SELECT id, airtable_id, status
      FROM pipeline_products
      WHERE id IN (${placeholders})
    `).all(...productIds) as ProductRecord[];

    if (products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 });
    }

    // Only allow deletion of products in 'waiting' status
    const nonWaitingProducts = products.filter(p => p.status !== 'waiting');
    if (nonWaitingProducts.length > 0) {
      return NextResponse.json(
        { error: 'Can only delete products with status "waiting"' },
        { status: 400 }
      );
    }

    // Delete from Airtable first
    if (AIRTABLE_API_KEY && PRODUCTS_TABLE_ID !== 'tblXXXXXXXXXXXXXX') {
      // Airtable delete supports max 10 records per request
      const airtableIds = products.map(p => p.airtable_id);
      const chunks = [];
      for (let i = 0; i < airtableIds.length; i += 10) {
        chunks.push(airtableIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const params = chunk.map(id => `records[]=${id}`).join('&');
        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${PRODUCTS_TABLE_ID}?${params}`;
        const airtableResponse = await fetch(airtableUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          },
        });

        if (!airtableResponse.ok) {
          const errorText = await airtableResponse.text();
          console.error('Airtable batch delete failed:', errorText);
          // Continue with local delete even if Airtable fails
        }
      }
    }

    // Delete from local SQLite database
    db.prepare(`
      DELETE FROM pipeline_products
      WHERE id IN (${placeholders})
    `).run(...productIds);

    return NextResponse.json({
      success: true,
      deleted: products.length,
    });
  } catch (error) {
    console.error('Error deleting products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
