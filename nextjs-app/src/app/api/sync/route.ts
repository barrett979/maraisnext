import { NextResponse } from 'next/server';
import { runSync, getSyncStatus } from '@/lib/sync';

// POST /api/sync - Trigger a manual sync
export async function POST() {
  const status = getSyncStatus();

  // Check if already syncing
  if (status.sync_in_progress) {
    return NextResponse.json(
      { error: 'Sync already in progress', status },
      { status: 409 }
    );
  }

  // Check env variables
  if (!process.env.DIRECT_TOKEN || !process.env.DIRECT_CLIENT_LOGIN) {
    return NextResponse.json(
      { error: 'DIRECT_TOKEN and DIRECT_CLIENT_LOGIN environment variables are required' },
      { status: 500 }
    );
  }

  // Run sync
  const result = await runSync();

  if (result.success) {
    return NextResponse.json({
      message: 'Sync completed successfully',
      records: result.records,
      status: getSyncStatus(),
    });
  } else {
    return NextResponse.json(
      { error: result.error, status: getSyncStatus() },
      { status: 500 }
    );
  }
}

// GET /api/sync - Get sync status
export async function GET() {
  const status = getSyncStatus();
  return NextResponse.json(status);
}
