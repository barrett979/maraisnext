'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n, type Locale } from '@/lib/i18n';

interface UserProfile {
  id: number;
  username: string;
  display_name: string | null;
  role: 'admin' | 'user';
  language: 'ru' | 'it';
  created_at: string;
}

export default function ProfilePage() {
  const { locale, setLocale, t } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [languageMessage, setLanguageMessage] = useState({ type: '', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get current user ID from session
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setDisplayName(data.user.display_name || '');
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setSavingProfile(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfileMessage({ type: 'success', text: t('profile.profileUpdated') });
      } else {
        const data = await res.json();
        setProfileMessage({ type: 'error', text: data.error || t('profile.updateError') });
      }
    } catch {
      setProfileMessage({ type: 'error', text: t('common.connectionError') });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user) return;

    setPasswordMessage({ type: '', text: '' });

    if (!newPassword) {
      setPasswordMessage({ type: 'error', text: t('profile.enterNewPasswordError') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: t('profile.passwordMismatch') });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: t('profile.passwordTooShort') });
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        setPasswordMessage({ type: 'success', text: t('profile.passwordUpdated') });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setPasswordMessage({ type: 'error', text: data.error || t('profile.updateError') });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: t('common.connectionError') });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLanguageChange = async (newLocale: Locale) => {
    setLanguageMessage({ type: '', text: '' });
    setLocale(newLocale);
    setLanguageMessage({ type: 'success', text: t('profile.languageUpdated') });
    setTimeout(() => setLanguageMessage({ type: '', text: '' }), 3000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              {t('profile.loadProfileError')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.accountInfo')}</CardTitle>
          <CardDescription>
            {t('profile.yourAccessData')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('auth.username')}</span>
              <span className="font-medium">{user.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('profile.role')}</span>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role === 'admin' ? t('common.admin') : t('common.user')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('profile.registeredSince')}</span>
              <span>{new Date(user.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.language')}</CardTitle>
          <CardDescription>
            {t('profile.selectLanguage')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={locale} onValueChange={(value) => handleLanguageChange(value as Locale)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">{t('languages.ru')}</SelectItem>
              <SelectItem value="it">{t('languages.it')}</SelectItem>
            </SelectContent>
          </Select>
          {languageMessage.text && (
            <p className={`text-sm ${languageMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {languageMessage.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Profile Edit Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.editProfile')}</CardTitle>
          <CardDescription>
            {t('profile.updateDisplayName')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.displayName')}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profile.yourName')}
            />
          </div>
          {profileMessage.text && (
            <p className={`text-sm ${profileMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {profileMessage.text}
            </p>
          )}
          <Button onClick={handleUpdateProfile} disabled={savingProfile}>
            {savingProfile ? t('profile.saving') : t('profile.saveChanges')}
          </Button>
        </CardContent>
      </Card>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.changePassword')}</CardTitle>
          <CardDescription>
            {t('profile.updateAccessPassword')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('profile.enterNewPassword')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('profile.confirmNewPassword')}
            />
          </div>
          {passwordMessage.text && (
            <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {passwordMessage.text}
            </p>
          )}
          <Button onClick={handleUpdatePassword} disabled={savingPassword}>
            {savingPassword ? t('profile.updating') : t('profile.updatePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
