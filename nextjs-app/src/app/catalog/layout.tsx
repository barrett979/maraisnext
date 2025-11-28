'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useI18n } from '@/lib/i18n';

interface Tab {
  nameKey: string;
  href: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { nameKey: 'catalog.productsOnSite', href: '/catalog/products', icon: Package },
];

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar with Sidebar Toggle + Tabs */}
      <div className="border-b">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-2" />
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.nameKey}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(tab.nameKey)}
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
