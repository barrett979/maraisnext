'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Trash2, RefreshCw, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface User {
  id: number;
  username: string;
  display_name: string | null;
  role: 'admin' | 'user';
  created_at: string;
}

interface SyncSettings {
  yandex_enabled: boolean;
  yandex_hour: number;
  moysklad_enabled: boolean;
  moysklad_hour: number;
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'user' as 'admin' | 'user'
  });
  const [error, setError] = useState('');

  // Sync settings state
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    yandex_enabled: false,
    yandex_hour: 6,
    moysklad_enabled: false,
    moysklad_hour: 7,
  });
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncSaved, setSyncSaved] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncSettings = async () => {
    try {
      const res = await fetch('/api/sync-settings');
      if (res.ok) {
        const data = await res.json();
        setSyncSettings(data);
      }
    } catch {
      // Ignore errors
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSyncSettings();
  }, []);

  const handleCreateUser = async () => {
    setError('');
    if (!newUser.username || !newUser.password) {
      setError(t('settings.usernamePasswordRequired'));
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        setDialogOpen(false);
        setNewUser({ username: '', password: '', displayName: '', role: 'user' });
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || t('settings.creationError'));
      }
    } catch {
      setError(t('common.connectionError'));
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      // Ignore errors
    }
  };

  const handleSaveSyncSettings = async () => {
    setSyncSaving(true);
    setSyncSaved(false);
    try {
      const res = await fetch('/api/sync-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncSettings),
      });
      if (res.ok) {
        setSyncSaved(true);
        setTimeout(() => setSyncSaved(false), 2000);
      }
    } catch {
      // Ignore errors
    } finally {
      setSyncSaving(false);
    }
  };

  // Generate hours array (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">{t('settings.userManagement')}</TabsTrigger>
          <TabsTrigger value="sync">{t('sync.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('settings.userManagement')}</CardTitle>
                  <CardDescription>{t('settings.createAndManageUsers')}</CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('settings.newUser')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('settings.createNewUser')}</DialogTitle>
                      <DialogDescription>
                        {t('settings.enterUserData')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">{t('auth.username')}</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder="username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">{t('auth.password')}</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName">{t('settings.name')}</Label>
                        <Input
                          id="displayName"
                          value={newUser.displayName}
                          onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                          placeholder={t('settings.fullName')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">{t('settings.role')}</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value: 'admin' | 'user') => setNewUser({ ...newUser, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{t('common.user')}</SelectItem>
                            <SelectItem value="admin">{t('common.admin')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {error && (
                        <p className="text-sm text-red-500">{error}</p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={handleCreateUser}>
                        {t('settings.createUser')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('settings.noUsersInDb')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('auth.username')}</TableHead>
                      <TableHead>{t('settings.name')}</TableHead>
                      <TableHead>{t('settings.role')}</TableHead>
                      <TableHead>{t('settings.created')}</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.display_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? t('common.admin') : t('common.user')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT')}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('settings.deleteUser')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('settings.deleteUserConfirm', { username: user.username })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('sync.title')}</CardTitle>
              <CardDescription>{t('sync.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {syncLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Yandex Direct */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{t('sync.yandexDirect')}</h3>
                        <Badge variant={syncSettings.yandex_enabled ? 'default' : 'secondary'}>
                          {syncSettings.yandex_enabled ? t('sync.enabled') : t('sync.disabled')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{t('sync.yandexDescription')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="yandex-hour" className="text-sm text-muted-foreground whitespace-nowrap">
                          {t('sync.syncTime')}
                        </Label>
                        <Select
                          value={String(syncSettings.yandex_hour)}
                          onValueChange={(v) => setSyncSettings({ ...syncSettings, yandex_hour: parseInt(v) })}
                        >
                          <SelectTrigger id="yandex-hour" className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hours.map((h) => (
                              <SelectItem key={h} value={String(h)}>
                                {String(h).padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Switch
                        checked={syncSettings.yandex_enabled}
                        onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, yandex_enabled: checked })}
                      />
                    </div>
                  </div>

                  {/* MoySklad */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{t('sync.moysklad')}</h3>
                        <Badge variant={syncSettings.moysklad_enabled ? 'default' : 'secondary'}>
                          {syncSettings.moysklad_enabled ? t('sync.enabled') : t('sync.disabled')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{t('sync.moyskladDescription')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="moysklad-hour" className="text-sm text-muted-foreground whitespace-nowrap">
                          {t('sync.syncTime')}
                        </Label>
                        <Select
                          value={String(syncSettings.moysklad_hour)}
                          onValueChange={(v) => setSyncSettings({ ...syncSettings, moysklad_hour: parseInt(v) })}
                        >
                          <SelectTrigger id="moysklad-hour" className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hours.map((h) => (
                              <SelectItem key={h} value={String(h)}>
                                {String(h).padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Switch
                        checked={syncSettings.moysklad_enabled}
                        onCheckedChange={(checked) => setSyncSettings({ ...syncSettings, moysklad_enabled: checked })}
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end">
                    <Button onClick={handleSaveSyncSettings} disabled={syncSaving}>
                      {syncSaving ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : syncSaved ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : null}
                      {syncSaved ? t('sync.settingsSaved') : t('common.save')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
