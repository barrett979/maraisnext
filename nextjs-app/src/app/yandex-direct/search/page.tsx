'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { PageFilters, useLocalFilters } from '@/components/page-filters';
import { cn } from '@/lib/utils';

interface SearchQuery {
  query: string;
  campaign: string;
  criterion: string;
  criteria_type: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  avg_cpc: number;
  avg_position: number;
  avg_impr_position: number;
  ctr: number;
  cpa: number;
  cr: number;
}

interface SearchData {
  queries: SearchQuery[];
  totals: {
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
    impressions: number;
    queries_count: number;
    cpa: number;
    cr: number;
  };
  totals_by_type: {
    KEYWORD: { clicks: number; cost: number; purchase: number; count: number };
    AUTOTARGETING: { clicks: number; cost: number; purchase: number; count: number };
    OTHER: { clicks: number; cost: number; purchase: number; count: number };
  };
  campaigns: string[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
}

const PAGE_SIZE = 100;

type SortDir = 'asc' | 'desc';

// Componente intestazione ordinabile
function SortableHeader({
  column,
  label,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  column: string;
  label: string;
  currentSort: string;
  currentDir: SortDir;
  onSort: (col: string) => void;
  className?: string;
}) {
  const isActive = currentSort === column;
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-muted/50 transition-colors', className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={cn('text-xs', isActive ? 'text-foreground' : 'text-muted-foreground/50')}>
          {isActive ? (currentDir === 'asc' ? '▲' : '▼') : '▼'}
        </span>
      </div>
    </TableHead>
  );
}

export default function SearchPage() {
  const { days, setDays, campaign, setCampaign, campaigns } = useLocalFilters({ fetchCampaigns: true });
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [criteriaType, setCriteriaType] = useState('__all__');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (days) params.set('days', days);
    if (campaign && campaign !== '__all__') params.set('campaign', campaign);
    if (criteriaType && criteriaType !== '__all__') params.set('type', criteriaType);
    if (search) params.set('search', search);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    const res = await fetch(`/api/search?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [days, campaign, criteriaType, search, offset, sortBy, sortDir]);

  // Gestione click su intestazione per ordinamento
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    setOffset(0); // Reset alla prima pagina
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setOffset(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const handlePrevPage = () => {
    if (offset >= PAGE_SIZE) {
      setOffset(offset - PAGE_SIZE);
    }
  };

  const handleNextPage = () => {
    if (data?.pagination.has_more) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = data ? Math.ceil(data.pagination.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Search Queries</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <PageFilters
            days={days}
            onDaysChange={setDays}
            campaign={campaign}
            onCampaignChange={setCampaign}
            campaigns={campaigns}
            showCampaignFilter={true}
          />
          <Input
            placeholder="Search queries..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-48 h-9"
          />
          <Select value={criteriaType} onValueChange={(v) => { setCriteriaType(v); setOffset(0); }}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              <SelectItem value="KEYWORD">Keyword</SelectItem>
              <SelectItem value="AUTOTARGETING">Autotargeting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Totals Cards */}
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
                  Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.totals.queries_count.toLocaleString()}
                </div>
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
                  {data?.totals.clicks.toLocaleString()}
                </div>
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
                  {data?.totals.cost.toLocaleString()}
                </div>
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
                  {data?.totals.purchase.toLocaleString()}
                </div>
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
                  {data?.totals.cpa.toFixed(0)}
                </div>
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
                  {data?.totals.cr.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Type breakdown */}
      {!loading && data && (
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">KEYWORD</Badge>
            <span className="text-muted-foreground">
              {data.totals_by_type.KEYWORD.count} queries,
              {data.totals_by_type.KEYWORD.purchase} purchases
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">AUTO</Badge>
            <span className="text-muted-foreground">
              {data.totals_by_type.AUTOTARGETING.count} queries,
              {data.totals_by_type.AUTOTARGETING.purchase} purchases
            </span>
          </div>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <SortableHeader column="query" label="Query" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="w-[300px]" />
                  <TableHead>Type</TableHead>
                  <SortableHeader column="clicks" label="Clicks" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader column="cost" label="Cost" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader column="purchase" label="Purch" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">CR%</TableHead>
                  <SortableHeader column="ctr" label="CTR%" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader column="avg_impr_position" label="IPos" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  data?.queries.map((q, i) => (
                    <TableRow key={`${q.campaign}-${q.query}-${i}`}>
                      <TableCell className="font-medium max-w-[300px] truncate" title={q.query}>
                        {q.query}
                      </TableCell>
                      <TableCell>
                        {q.criteria_type === 'KEYWORD' ? (
                          <Badge variant="outline" className="text-xs">KW</Badge>
                        ) : q.criteria_type === 'AUTOTARGETING' ? (
                          <Badge variant="secondary" className="text-xs">AUTO</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{q.criteria_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{q.clicks}</TableCell>
                      <TableCell className="text-right">{q.cost.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={q.purchase > 0 ? 'text-green-400 font-medium' : ''}>
                          {q.purchase}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {q.purchase > 0 ? q.cpa.toFixed(0) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={q.cr >= 1 ? 'text-green-400' : q.cr > 0 ? 'text-yellow-400' : ''}>
                          {q.cr.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={q.ctr >= 5 ? 'text-green-400' : q.ctr < 2 ? 'text-red-400' : ''}>
                          {q.ctr.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={q.avg_impr_position < 3 ? 'text-green-400' : q.avg_impr_position > 5 ? 'text-red-400' : ''}>
                          {q.avg_impr_position > 0 ? q.avg_impr_position.toFixed(1) : '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && data && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, data.pagination.total)} of {data.pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!data.pagination.has_more}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
