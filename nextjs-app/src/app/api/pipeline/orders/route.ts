import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';

interface PipelineOrder {
  id: number;
  airtable_id: string;
  order_id: number;
  order_date: string | null;
  supplier_id: number | null;
  brand: string | null;
  season: string | null;
  status: string | null;
  expected_delivery: string | null;
  gender: string | null;
  country: string | null;
  product: string | null;
  notes: string | null;
  archived: number;
  discount_percent: string | null;
  product_count: number;
  total_quantity: number;
  total_wholesale: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('all') === 'true';

  const db = getMetadataDb();

  // Query orders with product counts from pipeline_products
  // Join on order_id to get counts
  let query = `
    SELECT
      o.*,
      COALESCE(p.product_count, 0) as product_count,
      COALESCE(p.total_quantity, 0) as total_quantity,
      COALESCE(p.total_wholesale, 0) as total_wholesale
    FROM pipeline_orders o
    LEFT JOIN (
      SELECT
        order_id,
        COUNT(*) as product_count,
        SUM(quantity) as total_quantity,
        SUM(wholesale_price * quantity) as total_wholesale
      FROM pipeline_products
      WHERE order_id IS NOT NULL
      GROUP BY order_id
    ) p ON o.order_id = p.order_id
  `;

  // Filter for active orders (not archived and not canceled)
  if (!showAll) {
    query += ` WHERE o.archived = 0 AND o.status != 'отменён'`;
  }

  query += ` ORDER BY o.order_id DESC`;

  const orders = db.prepare(query).all() as PipelineOrder[];

  // Get summary stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN archived = 0 AND status != 'отменён' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) as archived,
      SUM(CASE WHEN status = 'отменён' THEN 1 ELSE 0 END) as canceled,
      SUM(CASE WHEN status = 'в работе' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'завершён' THEN 1 ELSE 0 END) as completed
    FROM pipeline_orders
  `).get() as {
    total: number;
    active: number;
    archived: number;
    canceled: number;
    in_progress: number;
    completed: number;
  };

  return NextResponse.json({
    orders,
    stats,
  });
}
