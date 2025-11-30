'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Home, Megaphone, LogOut, Settings, User, Package, ShoppingBag } from 'lucide-react';
import { Logo } from '@/components/logo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/lib/i18n';

interface UserInfo {
  username: string;
  display_name: string | null;
  role: string;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Ignore errors
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleNavigate = (path: string) => {
    setPopoverOpen(false);
    router.push(path);
  };

  // Check if current path is within Marketing section
  const isMarketingSection = pathname.startsWith('/yandex-direct');

  // Check if current path is within Catalog section
  const isCatalogSection = pathname.startsWith('/catalog');

  // Check if current path is within Pipeline section
  const isPipelineSection = pathname.startsWith('/pipeline');

  // Get initials for avatar
  const getInitials = () => {
    if (user?.display_name) {
      return user.display_name.charAt(0).toUpperCase();
    }
    if (user?.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const displayName = user?.display_name || user?.username || t('common.user');

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" className="block">
          <Logo className="h-6 w-auto" />
          <span className="text-xs text-muted-foreground mt-1 block">
            {t('nav.tagline')}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Home */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/'}>
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>{t('nav.home')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Marketing - Collapsible */}
              <Collapsible defaultOpen={isMarketingSection} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Megaphone className="h-4 w-4" />
                      <span>{t('nav.marketing')}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* Yandex Direct - Single link, tabs inside the section */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname.startsWith('/yandex-direct')}>
                          <Link href="/yandex-direct">
                            <span>{t('yandexDirect.title')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Pipeline - Collapsible */}
              <Collapsible defaultOpen={isPipelineSection} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <ShoppingBag className="h-4 w-4" />
                      <span>{t('pipeline.title')}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname.startsWith('/pipeline/orders')}>
                          <Link href="/pipeline/orders">
                            <span>{t('pipeline.supplierOrders')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Catalog - Collapsible */}
              <Collapsible defaultOpen={isCatalogSection} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Package className="h-4 w-4" />
                      <span>{t('catalog.title')}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname.startsWith('/catalog/products')}>
                          <Link href="/catalog/products">
                            <span>{t('catalog.productsOnSite')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.role === 'admin' ? t('common.admin') : t('common.user')}</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start" side="top">
              <div className="grid gap-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 h-9"
                  onClick={() => handleNavigate('/profile')}
                >
                  <User className="h-4 w-4" />
                  {t('nav.profile')}
                </Button>
                {user?.role === 'admin' && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-9"
                    onClick={() => handleNavigate('/settings')}
                  >
                    <Settings className="h-4 w-4" />
                    {t('nav.settings')}
                  </Button>
                )}
                <Separator className="my-1" />
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 h-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  {t('auth.logout')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
