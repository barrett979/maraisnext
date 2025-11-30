'use client';

import { Badge } from '@/components/ui/badge';

interface OrderStatusBadgeProps {
  status: string | null;
  t: (key: string) => string;
}

export function OrderStatusBadge({ status, t }: OrderStatusBadgeProps) {
  if (!status) return <Badge variant="secondary">-</Badge>;

  switch (status) {
    case 'в работе':
      return <Badge className="bg-blue-500 hover:bg-blue-600">{t('pipeline.inProgress')}</Badge>;
    case 'завершён':
      return <Badge className="bg-green-500 hover:bg-green-600">{t('pipeline.completed')}</Badge>;
    case 'отменён':
      return <Badge variant="destructive">{t('pipeline.canceled')}</Badge>;
    case 'internal':
      return <Badge variant="secondary">Internal</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
