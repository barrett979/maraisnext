import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers, createUser } from '@/lib/users';

// GET /api/users - List all users (admin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = getUsers();
  return NextResponse.json({ users });
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, password, displayName, role } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username e password richiesti' },
        { status: 400 }
      );
    }

    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Ruolo non valido' },
        { status: 400 }
      );
    }

    const user = createUser(username, password, displayName, role || 'user');
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'Username già esistente' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Errore durante la creazione utente' },
      { status: 500 }
    );
  }
}
