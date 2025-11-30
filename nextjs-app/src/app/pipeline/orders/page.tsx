'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useI18n } from '@/lib/i18n';

interface PipelineOrder {
  id: number;
  airtable_id: string;
  order_id: number;
  order_date: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  season: string | null;
  status: string | null;
  expected_delivery: string | null;
  gender: string | null;
  country: string | null;
  product: string | null;
  notes: string | null;
  archived: number;
  discount_percent: string | null;
  product_count: number;
  total_quantity: number;
  total_wholesale: number;
}

interface OrdersResponse {
  orders: PipelineOrder[];
  stats: {
    total: number;
    active: number;
    archived: number;
    canceled: number;
    in_progress: number;
    completed: number;
  };
}

function getStatusBadge(status: string | null, t: (key: string) => string) {
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

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function OrdersTable({ orders, locale, t }: { orders: PipelineOrder[]; locale: string; t: (key: string) => string }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('pipeline.noOrders')}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">{t('pipeline.orderId')}</TableHead>
          <TableHead>{t('pipeline.orderDate')}</TableHead>
          <TableHead>{t('pipeline.supplier')}</TableHead>
          <TableHead>{t('pipeline.season')}</TableHead>
          <TableHead>{t('pipeline.status')}</TableHead>
          <TableHead className="text-right">{t('pipeline.products')}</TableHead>
          <TableHead className="text-right">{t('pipeline.quantity')}</TableHead>
          <TableHead className="text-right">{t('pipeline.total')}</TableHead>
          <TableHead>{t('pipeline.expectedDelivery')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">#{order.order_id}</TableCell>
            <TableCell>{formatDate(order.order_date, locale)}</TableCell>
            <TableCell>{order.supplier_name || '-'}</TableCell>
            <TableCell>
              {order.season ? (
                <Badge variant="outline">{order.season}</Badge>
              ) : '-'}
            </TableCell>
            <TableCell>{getStatusBadge(order.status, t)}</TableCell>
            <TableCell className="text-right">{order.product_count || 0}</TableCell>
            <TableCell className="text-right">{order.total_quantity || 0}</TableCell>
            <TableCell className="text-right">
              {order.total_wholesale > 0 ? formatCurrency(order.total_wholesale) : '-'}
            </TableCell>
            <TableCell>{formatDate(order.expected_delivery, locale)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export default function PipelineOrdersPage() {
  const { t, locale } = useI18n();
  const [activeData, setActiveData] = useState<OrdersResponse | null>(null);
  const [allData, setAllData] = useState<OrdersResponse | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await fetch('/api/pipeline/orders');
        if (res.ok) {
          const data = await res.json();
          setActiveData(data);
        }
      } catch {
        // Ignore errors
      } finally {
        setLoadingActive(false);
      }
    };
    fetchActive();
  }, []);

  const handleTabChange = async (value: string) => {
    setActiveTab(value);

    if (value === 'all' && !allData) {
      setLoadingAll(true);
      try {
        const res = await fetch('/api/pipeline/orders?all=true');
        if (res.ok) {
          const data = await res.json();
          setAllData(data);
        }
      } catch {
        // Ignore errors
      } finally {
        setLoadingAll(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <h1 className="text-2xl font-bold">{t('pipeline.supplierOrders')}</h1>
        </div>
        {activeData?.stats && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{t('pipeline.inProgress')}: <strong>{activeData.stats.in_progress}</strong></span>
            <span>{t('pipeline.completed')}: <strong>{activeData.stats.completed}</strong></span>
            <span>{t('pipeline.canceled')}: <strong>{activeData.stats.canceled}</strong></span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="active">
                {t('pipeline.activeOrders')}
                {activeData?.stats && (
                  <Badge variant="secondary" className="ml-2">
                    {activeData.stats.active}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">
                {t('pipeline.allOrders')}
                {activeData?.stats && (
                  <Badge variant="secondary" className="ml-2">
                    {activeData.stats.total}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {activeTab === 'active' && (
            loadingActive ? (
              <TableSkeleton />
            ) : activeData ? (
              <OrdersTable orders={activeData.orders} locale={locale} t={t} />
            ) : null
          )}

          {activeTab === 'all' && (
            loadingAll ? (
              <TableSkeleton />
            ) : allData ? (
              <OrdersTable orders={allData.orders} locale={locale} t={t} />
            ) : null
          )}
        </CardContent>
      </Card>
    </div>
  );
}
