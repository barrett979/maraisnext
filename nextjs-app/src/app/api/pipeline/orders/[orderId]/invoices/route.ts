import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface InvoiceInfo {
  filename: string;
  url: string;
  type?: string;
}

// Allowed MIME types for invoice uploads
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Convert file to base64 for Cloudinary upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: `pipeline/invoices/${orderIdNum}`,
      public_id: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      resource_type: 'auto',
      overwrite: false, // Don't overwrite existing files
    });

    // Get current invoices from database
    const db = getMetadataDb();
    const order = db.prepare('SELECT invoices FROM pipeline_orders WHERE order_id = ?').get(orderIdNum) as { invoices: string | null } | undefined;

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Parse existing invoices or create new array
    let invoices: InvoiceInfo[] = [];
    if (order.invoices) {
      try {
        invoices = JSON.parse(order.invoices);
      } catch {
        invoices = [];
      }
    }

    // Add new invoice
    const newInvoice: InvoiceInfo = {
      filename: file.name,
      url: result.secure_url,
      type: file.type,
    };
    invoices.push(newInvoice);

    // Update database
    db.prepare('UPDATE pipeline_orders SET invoices = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?')
      .run(JSON.stringify(invoices), orderIdNum);

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      invoices,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove an invoice
export async function DELETE(
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
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    const db = getMetadataDb();
    const order = db.prepare('SELECT invoices FROM pipeline_orders WHERE order_id = ?').get(orderIdNum) as { invoices: string | null } | undefined;

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let invoices: InvoiceInfo[] = [];
    if (order.invoices) {
      try {
        invoices = JSON.parse(order.invoices);
      } catch {
        invoices = [];
      }
    }

    // Remove the invoice with matching filename
    const newInvoices = invoices.filter(inv => inv.filename !== filename);

    // Update database
    db.prepare('UPDATE pipeline_orders SET invoices = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?')
      .run(newInvoices.length > 0 ? JSON.stringify(newInvoices) : null, orderIdNum);

    return NextResponse.json({
      success: true,
      invoices: newInvoices,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
