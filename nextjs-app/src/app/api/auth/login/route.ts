import { NextRequest, NextResponse } from 'next/server';
import { createSession, validateCredentials, SESSION_COOKIE, SESSION_DURATION } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username e password richiesti' },
        { status: 400 }
      );
    }

    const user = validateCredentials(username, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      );
    }

    const token = await createSession(user);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      }
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: false, // TODO: Enable when HTTPS is configured
      sameSite: 'lax',
      maxAge: SESSION_DURATION,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Errore durante il login' },
      { status: 500 }
    );
  }
}
