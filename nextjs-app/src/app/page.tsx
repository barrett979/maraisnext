'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  Wallet,
  Receipt,
  Package,
  Truck,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { useI18n } from '@/lib/i18n';

interface KpiValue {
  value: number;
  yoyChange: number | null;
}

interface RevenueKpiValue extends KpiValue {
  estimated: number;
}

interface OrdersData {
  kpis: {
    totalOrders: KpiValue;
    revenue: RevenueKpiValue;
    completedOrders: KpiValue;
    completionRate: KpiValue;
    avgTicket: KpiValue;
    pendingOrders: KpiValue;
    courierSuccessRate: KpiValue;
  };
  charts: {
    ordersByDay: Array<{ day: string; orders: number; revenue: number }>;
    courierSuccess: Array<{
      courier: string;
      total_orders: number;
      successful_orders: number;
      success_rate: number;
    }>;
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
  ytd: {
    currentYear: number;
    prevYear: number;
    current: {
      revenue: number;
      estimated: number;
    };
    previous: {
      revenue: number;
    };
    yoyChange: number | null;
  };
}

const CHART_COLORS = ['#4ade80', '#f87171', '#fb923c', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8', '#fbbf24'];

const COURIER_COLORS: Record<string, string> = {
  'ИНТЕГРАЛ': '#3b82f6',
  'РУ ДОСТАВКА': '#10b981',
  'Boxberry': '#f59e0b',
  'СДЭК': '#ef4444',
  'Самовывоз': '#8b5cf6',
  'Не указан': '#6b7280',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(num);
}

function KpiCard({
  title,
  value,
  yoyChange,
  icon: Icon,
  format = 'number',
  invertColors = false,
}: {
  title: string;
  value: number;
  yoyChange: number | null;
  icon: React.ElementType;
  format?: 'number' | 'currency' | 'percent';
  invertColors?: boolean;
}) {
  const formattedValue = format === 'currency'
    ? formatCurrency(value)
    : format === 'percent'
      ? `${value}%`
      : formatNumber(value);

  const isPositive = yoyChange !== null && yoyChange > 0;
  const isNegative = yoyChange !== null && yoyChange < 0;

  // For cancelled orders, negative is good
  const showGreen = invertColors ? isNegative : isPositive;
  const showRed = invertColors ? isPositive : isNegative;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {yoyChange !== null && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${showGreen ? 'text-green-500' : showRed ? 'text-red-500' : 'text-muted-foreground'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
            <span>{yoyChange > 0 ? '+' : ''}{yoyChange}% vs LY</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueKpiCard({
  title,
  value,
  estimated,
  yoyChange,
  icon: Icon,
  confirmedLabel,
}: {
  title: string;
  value: number;
  estimated: number;
  yoyChange: number | null;
  icon: React.ElementType;
  confirmedLabel: string;
}) {
  const isPositive = yoyChange !== null && yoyChange > 0;
  const isNegative = yoyChange !== null && yoyChange < 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(estimated)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {confirmedLabel}: {formatCurrency(value)}
        </div>
        {yoyChange !== null && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
            <span>{yoyChange > 0 ? '+' : ''}{yoyChange}% vs LY</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const [days, setDays] = useState('30');
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/orders?days=${days}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('API returned error:', response.status);
          setData(null);
          return;
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch orders data:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 -mt-2">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-2" />
          <div>
            <h1 className="text-2xl font-bold">{t('home.dashboard')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('home.welcome')}
            </p>
          </div>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 {t('filters.days')}</SelectItem>
            <SelectItem value="30">30 {t('filters.days')}</SelectItem>
            <SelectItem value="90">90 {t('filters.days')}</SelectItem>
            <SelectItem value="365">365 {t('filters.days')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : data ? (
          <>
            <KpiCard
              title={t('orders.totalOrders')}
              value={data.kpis.totalOrders.value}
              yoyChange={data.kpis.totalOrders.yoyChange}
              icon={ShoppingCart}
            />
            <RevenueKpiCard
              title={t('orders.revenue')}
              value={data.kpis.revenue.value}
              estimated={data.kpis.revenue.estimated}
              yoyChange={data.kpis.revenue.yoyChange}
              icon={Wallet}
              confirmedLabel={t('orders.confirmed')}
            />
            <KpiCard
              title={t('orders.avgTicket')}
              value={data.kpis.avgTicket.value}
              yoyChange={data.kpis.avgTicket.yoyChange}
              icon={Receipt}
              format="currency"
            />
            <KpiCard
              title={t('orders.pending')}
              value={data.kpis.pendingOrders.value}
              yoyChange={null}
              icon={Package}
            />
            <KpiCard
              title={t('orders.courierSuccess')}
              value={data.kpis.courierSuccessRate.value}
              yoyChange={data.kpis.courierSuccessRate.yoyChange}
              icon={Truck}
              format="percent"
            />
            <RevenueKpiCard
              title={`${t('orders.ytdRevenue')} ${data.ytd.currentYear}`}
              value={data.ytd.current.revenue}
              estimated={data.ytd.current.estimated}
              yoyChange={data.ytd.yoyChange}
              icon={TrendingUp}
              confirmedLabel={t('orders.confirmed')}
            />
          </>
        ) : null}
      </div>

      {/* Charts Row - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Day Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('orders.ordersByDay')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.charts.ordersByDay && data.charts.ordersByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.charts.ordersByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'orders' ? value : formatCurrency(value),
                      name === 'orders' ? t('orders.orders') : t('orders.revenue'),
                    ]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('ru-RU')}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#4ade80"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Courier Success Rate */}
        <Card>
          <CardHeader>
            <CardTitle>{t('orders.courierSuccessRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.charts.courierSuccess && data.charts.courierSuccess.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.charts.courierSuccess}
                    layout="vertical"
                    margin={{ left: 10, right: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      dataKey="courier"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={90}
                    />
                    <Bar
                      dataKey="success_rate"
                      radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fontSize: 11, formatter: (v) => `${v}%` }}
                    >
                      {data.charts.courierSuccess.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COURIER_COLORS[entry.courier] || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 justify-center text-xs">
                  {data.charts.courierSuccess.map((entry, index) => (
                    <div key={entry.courier} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: COURIER_COLORS[entry.courier] || CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">
                        {entry.courier} ({entry.successful_orders}/{entry.total_orders})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
