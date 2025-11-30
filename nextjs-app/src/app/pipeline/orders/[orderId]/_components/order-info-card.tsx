'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Info, Pencil, Tag, Calendar, MapPin, Package } from 'lucide-react';
import { formatDate } from './utils';
import type { PipelineOrderDetail } from './types';

interface OrderInfoCardProps {
  order: PipelineOrderDetail;
  locale: string;
  onEdit: () => void;
  t: (key: string) => string;
}

export function OrderInfoCard({ order, locale, onEdit, t }: OrderInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {t('catalog.info')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">{t('pipeline.season')}</span>
              <p className="font-medium">{order.season || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">{t('pipeline.orderDate')}</span>
              <p className="font-medium">{formatDate(order.order_date, locale)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">{t('pipeline.country')}</span>
              <p className="font-medium">{order.country || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">{t('pipeline.expectedDelivery')}</span>
              <p className="font-medium">{formatDate(order.expected_delivery, locale)}</p>
            </div>
          </div>
          {order.gender && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">{t('pipeline.gender')}</span>
                <p className="font-medium">{order.gender}</p>
              </div>
            </div>
          )}
          {order.product && (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">{t('pipeline.productType')}</span>
                <p className="font-medium">{order.product}</p>
              </div>
            </div>
          )}
        </div>

        {order.notes && (
          <>
            <Separator className="my-3" />
            <div>
              <span className="text-sm text-muted-foreground">{t('pipeline.notes')}</span>
              <p className="text-sm whitespace-pre-wrap mt-1">{order.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
