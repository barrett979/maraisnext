'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageFilters, useLocalFilters } from '@/components/page-filters';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { TrendingUp, TrendingDown, Minus, Users, Target, MousePointer, Eye, ShoppingCart, CreditCard, Calendar } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface PerformanceMetrics {
  cost: number;
  clicks: number;
  impressions: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  cpa: number;
  cr: number;
  ctr: number;
  avgPosition: number;
  avgCpc: number;
  funnelEfficiency: number;
  campaignsCount: number;
}

interface TimelinePoint {
  date: string;
  cost: number;
  purchase: number;
  cpa: number;
  cr: number;
}

interface CampaignDetail {
  campaign_id: string;
  campaign: string;
  cost: number;
  purchase: number;
  cpa: number;
  cr: number;
}

interface ConsultantData {
  name: string;
  color: string;
  startDate: string | null;
  current: PerformanceMetrics;
  previous: PerformanceMetrics | null;
  timeline: TimelinePoint[];
  campaigns: CampaignDetail[];
}

interface PerformanceResponse {
  consultants: ConsultantData[];
  owners: Array<{ name: string; color: string }>;
  period: {
    current: { from: string; to: string };
    previous: { from: string; to: string };
  };
}

// Componente per mostrare la variazione
function ChangeIndicator({ change, inverted = false }: { change: number | null; inverted?: boolean }) {
  if (change === null) return <span className="text-muted-foreground">-</span>;

  const isPositive = inverted ? change < 0 : change > 0;
  const isNegative = inverted ? change > 0 : change < 0;

  return (
    <span className={cn(
      'flex items-center gap-1 text-sm',
      isPositive && 'text-green-500',
      isNegative && 'text-red-500',
      !isPositive && !isNegative && 'text-muted-foreground'
    )}>
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

// Calcola variazione percentuale
function calcChange(current: number, previous: number | undefined): number | null {
  if (!previous || previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

// Componente KPI Card con confronto
function ComparisonCard({
  title,
  icon: Icon,
  consultant,
  baseline,
  metric,
  format = 'number',
  inverted = false,
  consultantLabel,
}: {
  title: string;
  icon: React.ElementType;
  consultant: ConsultantData | undefined;
  baseline: ConsultantData | undefined;
  metric: keyof PerformanceMetrics;
  format?: 'number' | 'currency' | 'percent' | 'decimal';
  inverted?: boolean;
  consultantLabel: string;
}) {
  const consultantValue = consultant?.current[metric] ?? 0;
  const baselineValue = baseline?.current[metric] ?? 0;

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return Math.round(val).toLocaleString() + ' ₽';
      case 'percent':
        return val.toFixed(2) + '%';
      case 'decimal':
        return val.toFixed(1);
      default:
        return val.toLocaleString();
    }
  };

  const diff = baselineValue > 0 ? ((consultantValue - baselineValue) / baselineValue) * 100 : null;
  const isBetter = inverted ? (diff !== null && diff < 0) : (diff !== null && diff > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{consultant?.name || consultantLabel}</div>
            <div className="text-xl font-bold" style={{ color: consultant?.color }}>
              {formatValue(consultantValue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Marais</div>
            <div className="text-xl font-bold text-[#f97316]">
              {formatValue(baselineValue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Diff</div>
            <div className={cn(
              'text-xl font-bold',
              isBetter ? 'text-green-500' : diff !== null ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {diff !== null ? (diff > 0 ? '+' : '') + diff.toFixed(1) + '%' : '-'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Score Card per valutazione sintetica
function ScoreCard({ consultant, baseline, t, locale }: { consultant: ConsultantData | undefined; baseline: ConsultantData | undefined; t: (key: string) => string; locale: string }) {
  if (!consultant || consultant.current.cost === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            {t('yandexDirect.noCampaignsAssigned')}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calcola punteggio basato su varie metriche
  const scores: { metric: string; score: number; label: string }[] = [];

  // CPA (meglio se più basso)
  if (baseline?.current.cpa && consultant.current.cpa > 0) {
    const cpaRatio = consultant.current.cpa / baseline.current.cpa;
    const cpaScore = cpaRatio < 0.8 ? 100 : cpaRatio < 1 ? 80 : cpaRatio < 1.2 ? 60 : cpaRatio < 1.5 ? 40 : 20;
    scores.push({
      metric: 'CPA',
      score: cpaScore,
      label: cpaRatio < 1 ? `${Math.round((1 - cpaRatio) * 100)}% ${t('yandexDirect.betterBy').split(' ')[0]}` : `${Math.round((cpaRatio - 1) * 100)}% ${t('yandexDirect.worseBy').split(' ')[0]}`,
    });
  }

  // CR (meglio se più alto)
  if (baseline?.current.cr && consultant.current.cr > 0) {
    const crRatio = consultant.current.cr / baseline.current.cr;
    const crScore = crRatio > 1.5 ? 100 : crRatio > 1.2 ? 80 : crRatio > 1 ? 70 : crRatio > 0.8 ? 50 : 30;
    scores.push({
      metric: 'CR%',
      score: crScore,
      label: crRatio > 1 ? `${Math.round((crRatio - 1) * 100)}% ${t('yandexDirect.betterBy').split(' ')[0]}` : `${Math.round((1 - crRatio) * 100)}% ${t('yandexDirect.worseBy').split(' ')[0]}`,
    });
  }

  // CTR (meglio se più alto)
  if (baseline?.current.ctr && consultant.current.ctr > 0) {
    const ctrRatio = consultant.current.ctr / baseline.current.ctr;
    const ctrScore = ctrRatio > 1.3 ? 100 : ctrRatio > 1.1 ? 80 : ctrRatio > 0.9 ? 60 : ctrRatio > 0.7 ? 40 : 20;
    scores.push({
      metric: 'CTR',
      score: ctrScore,
      label: ctrRatio > 1 ? `${Math.round((ctrRatio - 1) * 100)}% ${t('yandexDirect.betterBy').split(' ')[0]}` : `${Math.round((1 - ctrRatio) * 100)}% ${t('yandexDirect.worseBy').split(' ')[0]}`,
    });
  }

  // Trend periodo precedente
  if (consultant.previous) {
    const cpaTrend = consultant.previous.cpa > 0
      ? (consultant.current.cpa - consultant.previous.cpa) / consultant.previous.cpa
      : 0;
    const trendScore = cpaTrend < -0.1 ? 100 : cpaTrend < 0 ? 80 : cpaTrend < 0.1 ? 60 : cpaTrend < 0.2 ? 40 : 20;
    scores.push({
      metric: t('yandexDirect.trend'),
      score: trendScore,
      label: cpaTrend < 0 ? t('yandexDirect.improving') : cpaTrend > 0.1 ? t('yandexDirect.worsening') : t('yandexDirect.stable'),
    });
  }

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 0;
  const stars = Math.round(avgScore / 20);

  return (
    <Card className={cn(
      avgScore >= 70 ? 'border-green-500/50' : avgScore >= 50 ? 'border-yellow-500/50' : 'border-red-500/50'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: consultant.color }}>
            <Users className="h-4 w-4" />
            {consultant.name}
          </CardTitle>
          <Badge variant={avgScore >= 70 ? 'default' : avgScore >= 50 ? 'secondary' : 'destructive'}>
            Score: {avgScore}/100
          </Badge>
        </div>
        <div className="text-2xl">
          {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {scores.map((s) => (
            <div key={s.metric} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.metric}</span>
              <span className={cn(
                s.score >= 70 ? 'text-green-500' : s.score >= 50 ? 'text-yellow-500' : 'text-red-500'
              )}>
                {s.label}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t mt-2 space-y-1">
            <div className="text-xs text-muted-foreground">
              {consultant.current.campaignsCount} {t('yandexDirect.campaignsManaged')} | {t('yandexDirect.budget')}: {Math.round(consultant.current.cost).toLocaleString()} ₽
            </div>
            {consultant.startDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{t('yandexDirect.withUsSince')} {new Date(consultant.startDate).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConsultantsPage() {
  const { t, locale } = useI18n();
  const { days, setDays } = useLocalFilters();
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConsultant, setSelectedConsultant] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (days) params.set('days', days);

    const res = await fetch(`/api/consultants/performance?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const baseline = data?.consultants.find(c => c.name === 'Marais');
  const consultants = data?.consultants.filter(c => c.name !== 'Marais') || [];
  const selectedData = selectedConsultant === 'all'
    ? consultants[0]
    : consultants.find(c => c.name === selectedConsultant);

  // Prepara dati per grafici comparativi
  const comparisonChartData = selectedData && baseline ? (() => {
    const allDates = new Set([
      ...selectedData.timeline.map(t => t.date),
      ...baseline.timeline.map(t => t.date),
    ]);
    return Array.from(allDates).sort().map(date => {
      const consultantPoint = selectedData.timeline.find(t => t.date === date);
      const baselinePoint = baseline.timeline.find(t => t.date === date);
      return {
        date: date.slice(5), // MM-DD
        [`${selectedData.name}_cpa`]: consultantPoint?.cpa || 0,
        [`${selectedData.name}_cr`]: consultantPoint?.cr || 0,
        marais_cpa: baselinePoint?.cpa || 0,
        marais_cr: baselinePoint?.cr || 0,
      };
    });
  })() : [];

  // Dati per bar chart comparativo
  const metricsComparisonData = selectedData && baseline ? [
    { metric: 'CPA', [selectedData.name]: selectedData.current.cpa, Marais: baseline.current.cpa },
    { metric: 'CR%', [selectedData.name]: selectedData.current.cr, Marais: baseline.current.cr },
    { metric: 'CTR%', [selectedData.name]: selectedData.current.ctr, Marais: baseline.current.ctr },
    { metric: 'CPC', [selectedData.name]: selectedData.current.avgCpc, Marais: baseline.current.avgCpc },
  ] : [];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('yandexDirect.consultantsTitle')}</h1>
          <p className="text-muted-foreground">
            {t('yandexDirect.consultantsSubtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <PageFilters
            days={days}
            onDaysChange={setDays}
          />
          <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder={t('yandexDirect.selectConsultant')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('yandexDirect.allConsultants')}</SelectItem>
              {consultants.map(c => (
                <SelectItem key={c.name} value={c.name}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Score Cards per tutti i consulenti */}
      {selectedConsultant === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consultants.map(c => (
            <ScoreCard key={c.name} consultant={c} baseline={baseline} t={t} locale={locale} />
          ))}
        </div>
      )}

      {/* Dettaglio singolo consulente */}
      {selectedConsultant !== 'all' && selectedData && (
        <>
          {/* Score Card prominente */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ScoreCard consultant={selectedData} baseline={baseline} t={t} locale={locale} />

            {/* KPI principali */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('yandexDirect.keyMetrics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">{t('yandexDirect.budgetManaged')}</div>
                    <div className="text-2xl font-bold">{Math.round(selectedData.current.cost).toLocaleString()} ₽</div>
                    <ChangeIndicator change={calcChange(selectedData.current.cost, selectedData.previous?.cost)} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('yandexDirect.conversions')}</div>
                    <div className="text-2xl font-bold">{selectedData.current.purchase}</div>
                    <ChangeIndicator change={calcChange(selectedData.current.purchase, selectedData.previous?.purchase)} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('metrics.cpa')}</div>
                    <div className="text-2xl font-bold">{Math.round(selectedData.current.cpa).toLocaleString()} ₽</div>
                    <ChangeIndicator change={calcChange(selectedData.current.cpa, selectedData.previous?.cpa)} inverted />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('metrics.cr')}</div>
                    <div className="text-2xl font-bold">{selectedData.current.cr.toFixed(2)}%</div>
                    <ChangeIndicator change={calcChange(selectedData.current.cr, selectedData.previous?.cr)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPI Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ComparisonCard
              title={t('yandexDirect.costPerPurchase')}
              icon={CreditCard}
              consultant={selectedData}
              baseline={baseline}
              metric="cpa"
              format="currency"
              inverted
              consultantLabel={t('yandexDirect.consultant')}
            />
            <ComparisonCard
              title={t('yandexDirect.conversionRate')}
              icon={ShoppingCart}
              consultant={selectedData}
              baseline={baseline}
              metric="cr"
              format="percent"
              consultantLabel={t('yandexDirect.consultant')}
            />
            <ComparisonCard
              title={t('yandexDirect.clickThroughRate')}
              icon={MousePointer}
              consultant={selectedData}
              baseline={baseline}
              metric="ctr"
              format="percent"
              consultantLabel={t('yandexDirect.consultant')}
            />
            <ComparisonCard
              title={t('yandexDirect.avgPosition')}
              icon={Target}
              consultant={selectedData}
              baseline={baseline}
              metric="avgPosition"
              format="decimal"
              inverted
              consultantLabel={t('yandexDirect.consultant')}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPA Timeline Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>{t('yandexDirect.cpaOverTime')}: {selectedData.name} {t('yandexDirect.vsMarais')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={`${selectedData.name}_cpa`}
                      stroke={selectedData.color}
                      strokeWidth={2}
                      dot={false}
                      name={selectedData.name}
                    />
                    <Line
                      type="monotone"
                      dataKey="marais_cpa"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                      name="Marais"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Metrics Bar Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>{t('yandexDirect.metricsComparison')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricsComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" fontSize={12} />
                    <YAxis dataKey="metric" type="category" stroke="#888" fontSize={12} width={50} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Legend />
                    <Bar dataKey={selectedData.name} fill={selectedData.color} />
                    <Bar dataKey="Marais" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Dettaglio Campagne */}
          <Card>
            <CardHeader>
              <CardTitle>{t('yandexDirect.campaignsManagedBy')} {selectedData.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('metrics.campaign')}</TableHead>
                      <TableHead className="text-right">{t('yandexDirect.spending')}</TableHead>
                      <TableHead className="text-right">{t('yandexDirect.conversions')}</TableHead>
                      <TableHead className="text-right">{t('metrics.cpa')}</TableHead>
                      <TableHead className="text-right">{t('metrics.cr')}</TableHead>
                      <TableHead className="text-right">{t('yandexDirect.vsMaraisCpa')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedData.campaigns.map((campaign) => {
                      const cpaDiff = baseline?.current.cpa && campaign.cpa > 0
                        ? ((campaign.cpa - baseline.current.cpa) / baseline.current.cpa) * 100
                        : null;
                      return (
                        <TableRow key={campaign.campaign_id}>
                          <TableCell className="font-medium">
                            <span className="truncate block max-w-[300px]" title={campaign.campaign}>
                              {campaign.campaign}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{Math.round(campaign.cost).toLocaleString()} ₽</TableCell>
                          <TableCell className="text-right">{campaign.purchase}</TableCell>
                          <TableCell className="text-right">{Math.round(campaign.cpa).toLocaleString()} ₽</TableCell>
                          <TableCell className="text-right">{campaign.cr.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">
                            <ChangeIndicator change={cpaDiff} inverted />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tabella comparativa tutti */}
      {selectedConsultant === 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('yandexDirect.comparativeTable')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('yandexDirect.consultant')}</TableHead>
                    <TableHead>{t('yandexDirect.startDate')}</TableHead>
                    <TableHead className="text-right">{t('yandexDirect.campaigns')}</TableHead>
                    <TableHead className="text-right">{t('yandexDirect.budget')}</TableHead>
                    <TableHead className="text-right">{t('yandexDirect.conversions')}</TableHead>
                    <TableHead className="text-right">{t('metrics.cpa')}</TableHead>
                    <TableHead className="text-right">{t('yandexDirect.vsMarais')}</TableHead>
                    <TableHead className="text-right">{t('metrics.cr')}</TableHead>
                    <TableHead className="text-right">CTR%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Marais row first */}
                  {baseline && (
                    <TableRow className="bg-[#f97316]/10">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                          Marais ({t('yandexDirect.baseline')})
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {baseline.startDate ? new Date(baseline.startDate).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT', { month: 'short', year: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{baseline.current.campaignsCount}</TableCell>
                      <TableCell className="text-right">{Math.round(baseline.current.cost).toLocaleString()} ₽</TableCell>
                      <TableCell className="text-right">{baseline.current.purchase}</TableCell>
                      <TableCell className="text-right">{Math.round(baseline.current.cpa).toLocaleString()} ₽</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right">{baseline.current.cr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{baseline.current.ctr.toFixed(2)}%</TableCell>
                    </TableRow>
                  )}
                  {consultants.map((c) => {
                    const cpaDiff = baseline?.current.cpa && c.current.cpa > 0
                      ? ((c.current.cpa - baseline.current.cpa) / baseline.current.cpa) * 100
                      : null;
                    return (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.startDate ? new Date(c.startDate).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT', { month: 'short', year: '2-digit' }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">{c.current.campaignsCount}</TableCell>
                        <TableCell className="text-right">{Math.round(c.current.cost).toLocaleString()} ₽</TableCell>
                        <TableCell className="text-right">{c.current.purchase}</TableCell>
                        <TableCell className="text-right">{Math.round(c.current.cpa).toLocaleString()} ₽</TableCell>
                        <TableCell className="text-right">
                          <ChangeIndicator change={cpaDiff} inverted />
                        </TableCell>
                        <TableCell className="text-right">{c.current.cr.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{c.current.ctr.toFixed(2)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
