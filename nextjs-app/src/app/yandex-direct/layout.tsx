'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Search, Monitor, Users } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const tabs = [
  { name: 'Dashboard', href: '/yandex-direct', icon: LayoutDashboard },
  { name: 'Search Queries', href: '/yandex-direct/search', icon: Search },
  { name: 'Display/YAN', href: '/yandex-direct/display', icon: Monitor },
  { name: 'Consulenti', href: '/yandex-direct/consultants', icon: Users },
];

export default function YandexDirectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar with Sidebar Toggle + Tabs */}
      <div className="border-b">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-2" />
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = tab.href === '/yandex-direct'
                ? pathname === '/yandex-direct'
                : pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
