'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { UserPlus } from 'lucide-react';
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
} from 'recharts';

interface PreviousTotals {
  impressions: number;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
}

interface DashboardData {
  dates: string[];
  total: {
    clicks: number[];
    cost: number[];
    purchase: number[];
    addtocart: number[];
    checkout: number[];
    avg_cpc: number[];
    impressions: number[];
  };
  previousTotals: PreviousTotals | null;
  campaigns: string[];
}

interface CampaignBreakdownItem {
  campaign_id: string;
  campaign: string;
  current: {
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
    cpa: number;
    cr: number;
  };
  previous: {
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
    cpa: number;
    cr: number;
  } | null;
  changes: {
    cost: number | null;
    purchase: number | null;
    addtocart: number | null;
    checkout: number | null;
    cpa: number | null;
    cr: number | null;
  } | null;
}

interface BreakdownData {
  campaignBreakdown: CampaignBreakdownItem[];
}

interface Owner {
  id: number;
  name: string;
  color: string | null;
}

interface MetadataResponse {
  metadata: Record<string, { owner: string | null; tags: string[] | null; notes: string | null }>;
  owners: Owner[];
}

interface MetricsTimelineData {
  cpcCpaTimeline: Array<{
    date: string;
    cpc: number;
    cpa: number;
  }>;
  budgetTimeline: Array<{
    date: string;
    search: number;
    yan: number;
    other: number;
  }>;
}

// Calcola variazione percentuale
function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

// Componente per mostrare la variazione rispetto al periodo precedente
function ChangeIndicator({ change, inverted = false }: { change: number | null; inverted?: boolean }) {
  if (change === null) return null;

  // Per CPA/Cost, un valore negativo è positivo (costo diminuito)
  const isPositive = inverted ? change < 0 : change > 0;
  const isNegative = inverted ? change > 0 : change < 0;

  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-xs text-muted-foreground">vs prec.</span>
      <span
        className={cn(
          'text-xs font-medium',
          isPositive && 'text-green-500',
          isNegative && 'text-red-500',
          !isPositive && !isNegative && 'text-muted-foreground'
        )}
      >
        {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    </div>
  );
}

// Componente inline per variazione nella tabella
function InlineChange({ change, inverted = false }: { change: number | null; inverted?: boolean }) {
  if (change === null) return <span className="text-muted-foreground">-</span>;

  const isPositive = inverted ? change < 0 : change > 0;
  const isNegative = inverted ? change > 0 : change < 0;

  return (
    <span
      className={cn(
        'text-xs',
        isPositive && 'text-green-500',
        isNegative && 'text-red-500',
        !isPositive && !isNegative && 'text-muted-foreground'
      )}
    >
      {change > 0 ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}


export default function Dashboard() {
  const { days, setDays, campaign, setCampaign, campaigns } = useLocalFilters({ fetchCampaigns: true });
  const [data, setData] = useState<DashboardData | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);
  const [metricsTimeline, setMetricsTimeline] = useState<MetricsTimelineData | null>(null);
  const [loadingMetricsTimeline, setLoadingMetricsTimeline] = useState(true);

  // Fetch metadata campagne
  const fetchMetadata = useCallback(async () => {
    const res = await fetch('/api/campaign-metadata');
    const json = await res.json();
    setMetadata(json);
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Assegna owner a campagna (usando campaign_id)
  const assignOwner = async (campaignId: string, campaignName: string, ownerName: string | null) => {
    await fetch('/api/campaign-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, campaign_name: campaignName, owner: ownerName }),
    });
    fetchMetadata();
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (days) params.set('days', days);
      if (campaign && campaign !== '__all__') params.set('campaign', campaign);

      const res = await fetch(`/api/dashboard?${params}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    };

    fetchData();
  }, [days, campaign]);

  // Fetch breakdown data separatamente
  useEffect(() => {
    const fetchBreakdown = async () => {
      setLoadingBreakdown(true);
      const params = new URLSearchParams();
      if (days) params.set('days', days);

      const res = await fetch(`/api/dashboard/breakdown?${params}`);
      const json = await res.json();
      setBreakdown(json);
      setLoadingBreakdown(false);
    };

    fetchBreakdown();
  }, [days]);

  // Fetch metrics timeline data (CPC, CPA, budget distribution)
  const fetchMetricsTimeline = useCallback(async () => {
    setLoadingMetricsTimeline(true);
    const params = new URLSearchParams();
    if (days) params.set('days', days);

    const res = await fetch(`/api/dashboard/metrics-timeline?${params}`);
    const json = await res.json();
    setMetricsTimeline(json);
    setLoadingMetricsTimeline(false);
  }, [days]);

  useEffect(() => {
    fetchMetricsTimeline();
  }, [fetchMetricsTimeline]);

  const chartData = data?.dates.map((date, i) => ({
    date: date.slice(5), // MM-DD format
    clicks: data.total.clicks[i],
    cost: data.total.cost[i],
    purchase: data.total.purchase[i],
    addtocart: data.total.addtocart[i],
    checkout: data.total.checkout[i],
  })) || [];

  // Dati per grafico CPC/CPA timeline
  const cpcCpaChartData = metricsTimeline?.cpcCpaTimeline.map(item => ({
    date: item.date.slice(5), // MM-DD format
    cpc: item.cpc,
    cpa: item.cpa,
  })) || [];

  // Dati per grafico distribuzione budget (Search/YAN/Altro)
  const budgetChartData = metricsTimeline?.budgetTimeline.map(item => ({
    date: item.date.slice(5), // MM-DD format
    search: item.search,
    yan: item.yan,
    other: item.other,
  })) || [];

  const totals = data ? {
    clicks: data.total.clicks.reduce((a, b) => a + b, 0),
    cost: data.total.cost.reduce((a, b) => a + b, 0),
    purchase: data.total.purchase.reduce((a, b) => a + b, 0),
    addtocart: data.total.addtocart.reduce((a, b) => a + b, 0),
    checkout: data.total.checkout.reduce((a, b) => a + b, 0),
    impressions: data.total.impressions.reduce((a, b) => a + b, 0),
  } : null;

  const cpa = totals && totals.purchase > 0 ? totals.cost / totals.purchase : 0;
  const cr = totals && totals.clicks > 0 ? (totals.purchase / totals.clicks) * 100 : 0;

  // Calcola variazioni rispetto al periodo precedente
  const prev = data?.previousTotals;
  const prevCpa = prev && prev.purchase > 0 ? prev.cost / prev.purchase : 0;
  const prevCr = prev && prev.clicks > 0 ? (prev.purchase / prev.clicks) * 100 : 0;

  const changes = prev && totals ? {
    impressions: calcChange(totals.impressions, prev.impressions),
    clicks: calcChange(totals.clicks, prev.clicks),
    cost: calcChange(totals.cost, prev.cost),
    purchase: calcChange(totals.purchase, prev.purchase),
    cpa: calcChange(cpa, prevCpa),
    cr: calcChange(cr, prevCr),
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <PageFilters
          days={days}
          onDaysChange={setDays}
          campaign={campaign}
          onCampaignChange={setCampaign}
          campaigns={campaigns}
          showCampaignFilter={true}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Impressions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totals?.impressions.toLocaleString()}
                </div>
                <ChangeIndicator change={changes?.impressions ?? null} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Clicks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totals?.clicks.toLocaleString()}
                </div>
                <ChangeIndicator change={changes?.clicks ?? null} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totals?.cost.toLocaleString()}
                </div>
                <ChangeIndicator change={changes?.cost ?? null} inverted />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {totals?.purchase.toLocaleString()}
                </div>
                <ChangeIndicator change={changes?.purchase ?? null} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  CPA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cpa.toFixed(0)}
                </div>
                <ChangeIndicator change={changes?.cpa ?? null} inverted />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  CR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cr.toFixed(2)}%
                </div>
                <ChangeIndicator change={changes?.cr ?? null} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="purchase"
                    stroke="#4ade80"
                    strokeWidth={2}
                    dot={false}
                    name="Purchase"
                  />
                  <Line
                    type="monotone"
                    dataKey="checkout"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    name="Checkout"
                  />
                  <Line
                    type="monotone"
                    dataKey="addtocart"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    name="Add to Cart"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost & Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#888" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cost"
                    stroke="#f87171"
                    strokeWidth={2}
                    dot={false}
                    name="Cost"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="clicks"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    name="Clicks"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CPC/CPA & Budget Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPC & CPA Chart */}
        <Card>
          <CardHeader>
            <CardTitle>CPC & CPA nel Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetricsTimeline ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cpcCpaChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#888" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cpc"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="CPC"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cpa"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={false}
                    name="CPA"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Budget Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione Budget: Search vs YAN</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetricsTimeline ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    formatter={(value: number) => value.toLocaleString()}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="search"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.6}
                    name="Search"
                  />
                  <Area
                    type="monotone"
                    dataKey="yan"
                    stackId="1"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.6}
                    name="YAN"
                  />
                  <Area
                    type="monotone"
                    dataKey="other"
                    stackId="1"
                    stroke="#6b7280"
                    fill="#6b7280"
                    fillOpacity={0.6}
                    name="Altro"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dettaglio Campagne */}
      <Card>
        <CardHeader>
          <CardTitle>Dettaglio Campagne vs Periodo Precedente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingBreakdown ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Campaign</TableHead>
                    <TableHead className="w-[100px]">Owner</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Cart</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Check</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Purch</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">CR%</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown?.campaignBreakdown.map((item) => {
                    const campaignOwner = metadata?.metadata[item.campaign_id]?.owner;
                    const isHovered = hoveredCampaign === item.campaign_id;
                    return (
                    <TableRow
                      key={item.campaign_id}
                      onMouseEnter={() => setHoveredCampaign(item.campaign_id)}
                      onMouseLeave={() => setHoveredCampaign(null)}
                      className="group"
                    >
                      <TableCell className="font-medium">
                        <span className="truncate block max-w-[200px]" title={item.campaign}>
                          {item.campaign}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-7 px-2 transition-opacity',
                                !campaignOwner && !isHovered && 'opacity-0 group-hover:opacity-100'
                              )}
                            >
                              {campaignOwner ? (
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                  style={{
                                    backgroundColor: metadata?.owners.find(o => o.name === campaignOwner)?.color || undefined,
                                    color: 'white'
                                  }}
                                >
                                  {campaignOwner}
                                </Badge>
                              ) : (
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {metadata?.owners.map((owner) => (
                              <DropdownMenuItem
                                key={owner.id}
                                onClick={() => assignOwner(item.campaign_id, item.campaign, owner.name)}
                                className="gap-2"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: owner.color || '#888' }}
                                />
                                {owner.name}
                                {campaignOwner === owner.name && (
                                  <span className="ml-auto text-green-500">✓</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                            {campaignOwner && (
                              <DropdownMenuItem
                                onClick={() => assignOwner(item.campaign_id, item.campaign, null)}
                                className="text-red-400"
                              >
                                Rimuovi owner
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right">{item.current.cost.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <InlineChange change={item.changes?.cost ?? null} inverted />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.current.addtocart > 0 ? 'text-yellow-400' : ''}>
                          {item.current.addtocart}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineChange change={item.changes?.addtocart ?? null} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.current.checkout > 0 ? 'text-blue-400' : ''}>
                          {item.current.checkout}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineChange change={item.changes?.checkout ?? null} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.current.purchase > 0 ? 'text-green-400' : ''}>
                          {item.current.purchase}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineChange change={item.changes?.purchase ?? null} />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.current.cpa > 0 ? item.current.cpa.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineChange change={item.changes?.cpa ?? null} inverted />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.current.cr > 0 ? item.current.cr.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineChange change={item.changes?.cr ?? null} />
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
