'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageFilters, useLocalFilters } from '@/components/page-filters';
import { cn } from '@/lib/utils';

interface DisplayItem {
  campaign?: string;
  adgroup?: string;
  placement?: string;
  criteria?: string;
  criteria_type?: string;
  campaigns?: string[];
  impressions: number;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  cpa: number;
  cr: number;
  ctr: number;
}

interface Pagination {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

interface DisplayData {
  adgroups?: DisplayItem[];
  placements?: DisplayItem[];
  criteria?: DisplayItem[];
  totals: {
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
    impressions: number;
    cpa: number;
    cr: number;
  };
  campaigns: string[];
  pagination: Pagination;
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

export default function DisplayPage() {
  const { days, setDays, campaign } = useLocalFilters();
  const [data, setData] = useState<DisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState('adgroups');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [allItems, setAllItems] = useState<DisplayItem[]>([]);
  const [sortBy, setSortBy] = useState('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const searchTimeout = useRef<NodeJS.Timeout>();

  const fetchData = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const params = new URLSearchParams();
    if (days) params.set('days', days);
    if (campaign && campaign !== '__all__') params.set('campaign', campaign);
    params.set('view', view);
    params.set('limit', PAGE_SIZE.toString());
    params.set('offset', offset.toString());
    if (search) params.set('search', search);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    const res = await fetch(`/api/display?${params}`);
    const json = await res.json();

    if (append) {
      // Append nuovi dati a quelli esistenti
      setAllItems(prev => [...prev, ...(json[view] || [])]);
      setData(prev => prev ? { ...prev, pagination: json.pagination } : json);
    } else {
      setAllItems(json[view] || []);
      setData(json);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [days, campaign, view, search, sortBy, sortDir]);

  // Reset e fetch quando cambiano filtri/view/search/sort
  useEffect(() => {
    setAllItems([]);
    fetchData(0, false);
  }, [days, campaign, view, search, sortBy, sortDir]);

  // Gestione click su intestazione per ordinamento
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle direzione se stessa colonna
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuova colonna, default desc
      setSortBy(column);
      setSortDir('desc');
    }
  };

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  };

  // Load more
  const loadMore = () => {
    if (data?.pagination.has_more && !loadingMore) {
      const nextOffset = data.pagination.offset + PAGE_SIZE;
      fetchData(nextOffset, true);
    }
  };

  const items = allItems;
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Display / YAN</h1>
        <div className="flex gap-2 items-center">
          <PageFilters
            days={days}
            onDaysChange={setDays}
          />
          <Input
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-64 h-9"
          />
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
                  Impressions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.totals.impressions.toLocaleString()}
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

      {/* Tabs for different views */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="adgroups">Ad Groups</TabsTrigger>
          <TabsTrigger value="placements">Placements</TabsTrigger>
          <TabsTrigger value="criteria">Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="adgroups" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <SortableHeader column="campaign" label="Campaign" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="w-[200px]" />
                      <SortableHeader column="adgroup" label="Ad Group" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="w-[200px]" />
                      <SortableHeader column="impressions" label="Impr" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="clicks" label="Clicks" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="cost" label="Cost" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="purchase" label="Purch" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CR%</TableHead>
                      <TableHead className="text-right">CTR%</TableHead>
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
                      items?.map((item, i) => (
                        <TableRow key={`${item.campaign}-${item.adgroup}-${i}`}>
                          <TableCell className="font-medium truncate max-w-[200px]" title={item.campaign}>
                            {item.campaign}
                          </TableCell>
                          <TableCell className="truncate max-w-[200px]" title={item.adgroup}>
                            {item.adgroup}
                          </TableCell>
                          <TableCell className="text-right">{item.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.clicks}</TableCell>
                          <TableCell className="text-right">{item.cost.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.purchase > 0 ? 'text-green-400 font-medium' : ''}>
                              {item.purchase}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.purchase > 0 ? item.cpa.toFixed(0) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.cr >= 1 ? 'text-green-400' : ''}>
                              {item.cr.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{item.ctr.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="placements" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <SortableHeader column="placement" label="Placement" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="w-[300px]" />
                      <SortableHeader column="impressions" label="Impr" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="clicks" label="Clicks" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="cost" label="Cost" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="purchase" label="Purch" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CR%</TableHead>
                      <TableHead className="text-right">CTR%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      items?.map((item, i) => (
                        <TableRow key={`${item.placement}-${i}`}>
                          <TableCell className="font-medium truncate max-w-[300px]" title={item.placement}>
                            {item.placement}
                          </TableCell>
                          <TableCell className="text-right">{item.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.clicks}</TableCell>
                          <TableCell className="text-right">{item.cost.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.purchase > 0 ? 'text-green-400 font-medium' : ''}>
                              {item.purchase}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.purchase > 0 ? item.cpa.toFixed(0) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.cr >= 1 ? 'text-green-400' : ''}>
                              {item.cr.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{item.ctr.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="criteria" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <SortableHeader column="criteria" label="Criteria" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="w-[250px]" />
                      <TableHead>Type</TableHead>
                      <SortableHeader column="impressions" label="Impr" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="clicks" label="Clicks" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="cost" label="Cost" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHeader column="purchase" label="Purch" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="text-right" />
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CR%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      items?.map((item, i) => (
                        <TableRow key={`${item.criteria}-${item.criteria_type}-${i}`}>
                          <TableCell className="font-medium truncate max-w-[250px]" title={item.criteria || '-'}>
                            {item.criteria || '(empty)'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {item.criteria_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.clicks}</TableCell>
                          <TableCell className="text-right">{item.cost.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.purchase > 0 ? 'text-green-400 font-medium' : ''}>
                              {item.purchase}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.purchase > 0 ? item.cpa.toFixed(0) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.cr >= 1 ? 'text-green-400' : ''}>
                              {item.cr.toFixed(2)}
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
        </TabsContent>
      </Tabs>

      {/* Pagination info and Load More */}
      {!loading && pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {items.length} of {pagination.total} {view}
          </div>
          {pagination.has_more && (
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : `Load more (${pagination.total - items.length} remaining)`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
