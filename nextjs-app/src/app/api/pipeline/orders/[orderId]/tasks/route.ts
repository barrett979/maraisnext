import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDgAaPpN2ZNh0Cx';
const ORDERS_TABLE_ID = 'tbl0q2H0C2Q4QMUne';

// Map from our task names to Airtable field names
const TASK_FIELD_MAP: Record<string, string> = {
  task_proforma: 'proforma',
  task_acconto: 'acconto',
  task_fullfilled: 'fullfilled',
  task_saldo: 'saldo',
  task_ritirato: 'ritirato',
};

const VALID_TASKS = Object.keys(TASK_FIELD_MAP);

interface OrderRecord {
  airtable_id: string;
  task_proforma: number;
  task_acconto: number;
  task_fullfilled: number;
  task_saldo: number;
  task_ritirato: number;
}

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

  try {
    const body = await request.json();
    const { task, value } = body;

    // Validate task name
    if (!task || !VALID_TASKS.includes(task)) {
      return NextResponse.json(
        { error: `Invalid task. Must be one of: ${VALID_TASKS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate value
    if (typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'Value must be a boolean' },
        { status: 400 }
      );
    }

    const db = getMetadataDb();

    // Get the order to find airtable_id
    const order = db.prepare(`
      SELECT airtable_id, task_proforma, task_acconto, task_fullfilled, task_saldo, task_ritirato
      FROM pipeline_orders
      WHERE order_id = ?
    `).get(orderIdNum) as OrderRecord | undefined;

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update Airtable first
    if (AIRTABLE_API_KEY) {
      const airtableField = TASK_FIELD_MAP[task];
      const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ORDERS_TABLE_ID}/${order.airtable_id}`;

      const airtableResponse = await fetch(airtableUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            [airtableField]: value,
          },
        }),
      });

      if (!airtableResponse.ok) {
        const errorText = await airtableResponse.text();
        console.error('Airtable update failed:', errorText);
        return NextResponse.json(
          { error: 'Failed to update Airtable' },
          { status: 500 }
        );
      }
    }

    // Update local SQLite database
    const sqliteValue = value ? 1 : 0;
    db.prepare(`
      UPDATE pipeline_orders
      SET ${task} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(sqliteValue, orderIdNum);

    // Return updated task values
    const updatedOrder = db.prepare(`
      SELECT task_proforma, task_acconto, task_fullfilled, task_saldo, task_ritirato
      FROM pipeline_orders
      WHERE order_id = ?
    `).get(orderIdNum) as Omit<OrderRecord, 'airtable_id'>;

    return NextResponse.json({
      success: true,
      tasks: {
        task_proforma: !!updatedOrder.task_proforma,
        task_acconto: !!updatedOrder.task_acconto,
        task_fullfilled: !!updatedOrder.task_fullfilled,
        task_saldo: !!updatedOrder.task_saldo,
        task_ritirato: !!updatedOrder.task_ritirato,
      },
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
