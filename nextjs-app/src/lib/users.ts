import { getMetadataDb } from './db';
import * as crypto from 'crypto';

export type Language = 'ru' | 'it';

export interface User {
  id: number;
  username: string;
  display_name: string | null;
  role: 'admin' | 'user';
  language: Language;
  created_at: string;
  updated_at: string;
}

interface UserWithPassword extends User {
  password_hash: string;
}

// Hash password with SHA-256 + salt
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(password + usedSalt).digest('hex');
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

// Verify password
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const { hash: computedHash } = hashPassword(password, salt);
  return computedHash === storedHash;
}

// Get all users (without password)
export function getUsers(): User[] {
  const db = getMetadataDb();
  return db.prepare(`
    SELECT id, username, display_name, role, language, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
  `).all() as User[];
}

// Get user by ID
export function getUserById(id: number): User | null {
  const db = getMetadataDb();
  const user = db.prepare(`
    SELECT id, username, display_name, role, language, created_at, updated_at
    FROM users WHERE id = ?
  `).get(id) as User | undefined;
  return user || null;
}

// Get user by username (for auth)
export function getUserByUsername(username: string): UserWithPassword | null {
  const db = getMetadataDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserWithPassword | undefined;
  return user || null;
}

// Validate credentials
export function validateUserCredentials(username: string, password: string): User | null {
  const user = getUserByUsername(username);
  if (!user) return null;

  if (verifyPassword(password, user.password_hash)) {
    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

// Create user
export function createUser(
  username: string,
  password: string,
  displayName?: string,
  role: 'admin' | 'user' = 'user',
  language: Language = 'ru'
): User {
  const db = getMetadataDb();
  const { hash } = hashPassword(password);
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role, language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username, hash, displayName || username, role, language, now, now);

  return {
    id: result.lastInsertRowid as number,
    username,
    display_name: displayName || username,
    role,
    language,
    created_at: now,
    updated_at: now
  };
}

// Update user profile
export function updateUserProfile(id: number, displayName: string): User | null {
  const db = getMetadataDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?
  `).run(displayName, now, id);

  return getUserById(id);
}

// Update user password
export function updateUserPassword(id: number, newPassword: string): boolean {
  const db = getMetadataDb();
  const { hash } = hashPassword(newPassword);
  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
  `).run(hash, now, id);

  return result.changes > 0;
}

// Update user language
export function updateUserLanguage(id: number, language: Language): User | null {
  const db = getMetadataDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users SET language = ?, updated_at = ? WHERE id = ?
  `).run(language, now, id);

  return getUserById(id);
}

// Delete user
export function deleteUser(id: number): boolean {
  const db = getMetadataDb();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

