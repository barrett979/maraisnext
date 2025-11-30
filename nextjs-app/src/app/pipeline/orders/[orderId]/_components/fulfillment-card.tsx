'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Package } from 'lucide-react';
import { ProgressWidget } from './progress-widget';

interface FulfillmentStats {
  fulfilledCount: number;
  fulfilledQty: number;
  totalCount: number;
  totalQty: number;
}

interface FulfillmentCardProps {
  stats: FulfillmentStats;
  t: (key: string) => string;
}

export function FulfillmentCard({ stats, t }: FulfillmentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          {t('pipeline.products')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressWidget
          label={t('pipeline.fulfillment')}
          current={stats.fulfilledCount}
          total={stats.totalCount}
          currentLabel={t('pipeline.fulfilled')}
          totalLabel={t('pipeline.total')}
          color="bg-green-500"
        />
        <Separator />
        <ProgressWidget
          label={t('pipeline.quantity')}
          current={stats.fulfilledQty}
          total={stats.totalQty}
          currentLabel={t('pipeline.fulfilled')}
          totalLabel={t('pipeline.total')}
          color="bg-blue-500"
        />
      </CardContent>
    </Card>
  );
}
