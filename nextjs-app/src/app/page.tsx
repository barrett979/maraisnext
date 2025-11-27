'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { BarChart3 } from 'lucide-react';

interface ServiceCard {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  status: 'active' | 'coming_soon';
  features: string[];
}

const services: ServiceCard[] = [
  {
    title: 'Yandex Direct',
    description: 'Dashboard analytics per campagne Yandex Direct con metriche dettagliate, analisi search queries e performance display/YAN.',
    href: '/yandex-direct',
    icon: BarChart3,
    status: 'active',
    features: ['Dashboard KPI', 'Search Queries', 'Display/YAN', 'Valutazione Consulenti'],
  },
  // Servizi futuri possono essere aggiunti qui
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Header with Sidebar Toggle */}
      <div className="flex items-center gap-4 border-b pb-4 -mt-2">
        <SidebarTrigger className="-ml-2" />
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Benvenuto nella piattaforma di analytics marketing
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Link key={service.title} href={service.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                      {service.status === 'active' ? 'Attivo' : 'Coming Soon'}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{service.title}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {service.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
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
