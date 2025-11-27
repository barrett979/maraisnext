'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { BarChart3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface ServiceCard {
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: React.ElementType;
  status: 'active' | 'coming_soon';
  featureKeys: string[];
}

const services: ServiceCard[] = [
  {
    titleKey: 'yandexDirect.title',
    descriptionKey: 'yandexDirect.description',
    href: '/yandex-direct',
    icon: BarChart3,
    status: 'active',
    featureKeys: [
      'yandexDirect.features.dashboard',
      'yandexDirect.features.searchQueries',
      'yandexDirect.features.displayYan',
      'yandexDirect.features.consultants'
    ],
  },
];

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      {/* Header with Sidebar Toggle */}
      <div className="flex items-center gap-4 border-b pb-4 -mt-2">
        <SidebarTrigger className="-ml-2" />
        <div>
          <h1 className="text-2xl font-bold">{t('home.dashboard')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('home.welcome')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Link key={service.titleKey} href={service.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                      {service.status === 'active' ? t('home.active') : t('home.comingSoon')}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{t(service.titleKey)}</CardTitle>
                  <CardDescription>{t(service.descriptionKey)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {service.featureKeys.map((featureKey) => (
                      <Badge key={featureKey} variant="outline" className="text-xs">
                        {t(featureKey)}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
