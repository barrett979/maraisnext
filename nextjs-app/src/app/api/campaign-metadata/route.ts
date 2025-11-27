import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';

// GET - Ottieni tutti i metadata delle campagne e lista owners
export async function GET() {
  const db = getMetadataDb();

  const metadata = db.prepare(`
    SELECT campaign_id, campaign_name, owner, tags, notes FROM campaign_metadata
  `).all() as Array<{
    campaign_id: string;
    campaign_name: string | null;
    owner: string | null;
    tags: string | null;
    notes: string | null;
  }>;

  const owners = db.prepare(`
    SELECT id, name, color FROM owners ORDER BY name
  `).all() as Array<{
    id: number;
    name: string;
    color: string | null;
  }>;

  // Converti in mappa per accesso veloce (chiave = campaign_id)
  const metadataMap: Record<string, { owner: string | null; tags: string[] | null; notes: string | null; campaign_name: string | null }> = {};
  for (const row of metadata) {
    metadataMap[row.campaign_id] = {
      owner: row.owner,
      tags: row.tags ? JSON.parse(row.tags) : null,
      notes: row.notes,
      campaign_name: row.campaign_name,
    };
  }

  return NextResponse.json({ metadata: metadataMap, owners });
}

// POST - Aggiorna owner di una campagna (usando campaign_id)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { campaign_id, campaign_name, owner } = body;

  if (!campaign_id) {
    return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
  }

  const db = getMetadataDb();

  // Upsert: inserisci o aggiorna usando campaign_id
  db.prepare(`
    INSERT INTO campaign_metadata (campaign_id, campaign_name, owner, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(campaign_id) DO UPDATE SET
      campaign_name = excluded.campaign_name,
      owner = excluded.owner,
      updated_at = CURRENT_TIMESTAMP
  `).run(campaign_id, campaign_name || null, owner || null);

  return NextResponse.json({ success: true, campaign_id, campaign_name, owner });
}
