import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface PaymentInput {
  payment_date: string;
  amount_eur: number;
  payment_details: string | null;
}

export async function POST(
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

  const body: PaymentInput = await request.json();

  if (!body.payment_date || !body.amount_eur) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getMetadataDb();

  // Get the max payment_id for this order to generate a new one
  const maxPayment = db.prepare(`
    SELECT MAX(payment_id) as max_id FROM pipeline_payments WHERE order_id = ?
  `).get(orderIdNum) as { max_id: number | null };

  const newPaymentId = (maxPayment?.max_id || 0) + 1;

  // Insert the new payment
  const result = db.prepare(`
    INSERT INTO pipeline_payments (payment_id, order_id, payment_date, amount_eur, payment_details)
    VALUES (?, ?, ?, ?, ?)
  `).run(newPaymentId, orderIdNum, body.payment_date, body.amount_eur, body.payment_details);

  // Return the new payment
  const newPayment = db.prepare(`
    SELECT id, payment_id, payment_date, amount_eur, payment_details
    FROM pipeline_payments
    WHERE id = ?
  `).get(result.lastInsertRowid) as {
    id: number;
    payment_id: number;
    payment_date: string | null;
    amount_eur: number | null;
    payment_details: string | null;
  };

  return NextResponse.json(newPayment);
}
