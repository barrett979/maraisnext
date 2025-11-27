import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, deleteUser, updateUserProfile, updateUserPassword, updateUserLanguage, type Language } from '@/lib/users';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get user by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);

  // Users can only view themselves unless admin
  if (session.role !== 'admin' && session.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// PATCH /api/users/[id] - Update user
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);

  // Users can only update themselves unless admin
  if (session.role !== 'admin' && session.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { displayName, password, language } = body;

    if (displayName !== undefined) {
      const user = updateUserProfile(userId, displayName);
      if (!user) {
        return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
      }
    }

    if (password) {
      const success = updateUserPassword(userId, password);
      if (!success) {
        return NextResponse.json({ error: 'Errore aggiornamento password' }, { status: 500 });
      }
    }

    if (language && (language === 'ru' || language === 'it')) {
      const user = updateUserLanguage(userId, language as Language);
      if (!user) {
        return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
      }
    }

    const user = getUserById(userId);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);

  // Cannot delete yourself
  if (session.userId === userId) {
    return NextResponse.json(
      { error: 'Non puoi eliminare te stesso' },
      { status: 400 }
    );
  }

  const success = deleteUser(userId);
  if (!success) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
