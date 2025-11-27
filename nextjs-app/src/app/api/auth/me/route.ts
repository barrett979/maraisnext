import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/users';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Get full user data from database
    const user = getUserById(session.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        language: user.language,
        created_at: user.created_at
      }
    });
  } catch {
    return NextResponse.json(
      { error: 'Errore durante il recupero del profilo' },
      { status: 500 }
    );
  }
}
