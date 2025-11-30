import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface PipelineProduct {
  id: number;
  airtable_id: string;
  status: string | null;
  product_image: string | null;
  color_image: string | null;
  sku: string | null;
  supplier_sku: string | null;
  category: string | null;
  color: string | null;
  quantity: number;
  wholesale_price: number;
  product_title: string | null;
  size_set: string | null;
  heel_height: string | null;
  sole_height: string | null;
  upper_material: string | null;
  insole_material: string | null;
  sole_material: string | null;
  lining_material: string | null;
  notes: string | null;
}

interface PipelineOrderDetail {
  id: number;
  airtable_id: string;
  order_id: number;
  order_date: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  season: string | null;
  status: string | null;
  expected_delivery: string | null;
  gender: string | null;
  country: string | null;
  product: string | null;
  notes: string | null;
  invoices: string | null; // JSON array of {filename, url, type}
  archived: number;
  discount_percent: number | null;
  task_proforma: number;
  task_acconto: number;
  task_fullfilled: number;
  task_saldo: number;
  task_ritirato: number;
}

interface PipelinePayment {
  id: number;
  payment_id: number;
  payment_date: string | null;
  amount_eur: number | null;
  payment_details: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = await params;
  const orderIdNum = Number(orderId);
  if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  const db = getMetadataDb();

  // Get order details with supplier name
  const order = db.prepare(`
    SELECT
      o.*,
      s.supplier_name
    FROM pipeline_orders o
    LEFT JOIN pipeline_suppliers s ON o.supplier_id = s.supplier_id
    WHERE o.order_id = ?
  `).get(orderIdNum) as PipelineOrderDetail | undefined;

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Get products for this order
  const products = db.prepare(`
    SELECT
      id, airtable_id, status, product_image, color_image, sku, supplier_sku,
      category, color, quantity, wholesale_price, product_title,
      size_set, heel_height, sole_height, upper_material,
      insole_material, sole_material, lining_material, notes
    FROM pipeline_products
    WHERE order_id = ?
    ORDER BY supplier_sku
  `).all(orderIdNum) as PipelineProduct[];

  // Get payments for this order
  const payments = db.prepare(`
    SELECT id, payment_id, payment_date, amount_eur, payment_details
    FROM pipeline_payments
    WHERE order_id = ?
    ORDER BY payment_date DESC
  `).all(orderIdNum) as PipelinePayment[];

  // Calculate totals
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_eur || 0), 0);
  const totals = {
    productCount: products.length,
    totalQuantity: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
    totalWholesale: products.reduce((sum, p) => sum + (p.wholesale_price || 0) * (p.quantity || 0), 0),
    totalPaid,
  };

  return NextResponse.json({
    order,
    products,
    payments,
    totals,
  });
}

// Update order fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = await params;
  const orderIdNum = Number(orderId);
  if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  const body = await request.json();
  const db = getMetadataDb();

  // Build dynamic update query based on provided fields
  const allowedFields = [
    'season', 'order_date', 'expected_delivery', 'country', 'gender',
    'product', 'notes', 'discount_percent', 'status',
    'task_proforma', 'task_acconto', 'task_fullfilled', 'task_saldo', 'task_ritirato'
  ];

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Add updated_at
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(orderIdNum);

  const sql = `UPDATE pipeline_orders SET ${updates.join(', ')} WHERE order_id = ?`;
  db.prepare(sql).run(...values);

  return NextResponse.json({ success: true });
}
