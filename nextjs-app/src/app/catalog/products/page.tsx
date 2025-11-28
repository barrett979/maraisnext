'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Check, X, Image as ImageIcon, FilterX } from 'lucide-react';
import { ImageZoom } from '@/components/image-zoom';
import { ProductDetailSheet } from '@/components/product-detail-sheet';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  slug: string | null;
  active: boolean;
  manufacturer_name: string | null;
  price: string | null;
  sale_price: string | null;
  sale: boolean;
  description: string | null;
  novinki: boolean;
  gender: string | null;
  category_airtable: string | null;
  season: string | null;
  main_image: string | null;
  date_created: string | null;
  date_updated: string | null;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  limit: number;
  offset: number;
  brands: string[];
  categories: string[];
  seasons: string[];
  colors: string[];
  error?: string;
}

export default function ProductsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Product detail sheet
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Read filters from URL
  const search = searchParams.get('search') || '';
  const brand = searchParams.get('brand') || '__all__';
  const category = searchParams.get('category') || '__all__';
  const season = searchParams.get('season') || '__all__';
  const color = searchParams.get('color') || '__all__';
  const gender = searchParams.get('gender') || '__all__';
  const active = searchParams.get('active') || '__all__';
  const novinki = searchParams.get('novinki') || '__all__';

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Local search state for debouncing
  const [searchInput, setSearchInput] = useState(search);

  // Sync searchInput with URL on mount/change
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Update URL with new params
  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== '__all__' && value !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, updateParams]);

  // Filter setters that update URL
  const setFilter = useCallback((key: string, value: string) => {
    updateParams({ [key]: value });
  }, [updateParams]);

  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
    setSearchInput('');
  }, [router, pathname]);

  const fetchProducts = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(currentOffset));

    if (search) params.set('search', search);
    if (brand && brand !== '__all__') params.set('brand', brand);
    if (category && category !== '__all__') params.set('category', category);
    if (season && season !== '__all__') params.set('season', season);
    if (color && color !== '__all__') params.set('color', color);
    if (gender && gender !== '__all__') params.set('gender', gender);
    if (active && active !== '__all__') params.set('active', active);
    if (novinki && novinki !== '__all__') params.set('novinki', novinki);

    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      const data: ProductsResponse = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setError(null);

      if (reset) {
        setProducts(data.products || []);
        setOffset(0);
      } else if (currentOffset === 0) {
        setProducts(data.products || []);
      } else {
        // Filter out duplicates when appending
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProducts = (data.products || []).filter(p => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }

      setTotal(data.total || 0);
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setSeasons(data.seasons || []);
      setColors(data.colors || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to connect to database');
    } finally {
      setLoading(false);
    }
  }, [offset, search, brand, category, season, gender, active, novinki]);

  // Fetch when URL params change
  useEffect(() => {
    setOffset(0);
    fetchProducts(true);
  }, [search, brand, category, season, gender, active, novinki]);

  // Load more
  const loadMore = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
  };

  useEffect(() => {
    if (offset > 0) {
      fetchProducts(false);
    }
  }, [offset]);

  // Check if any filter is active
  const hasActiveFilters = search || brand !== '__all__' || category !== '__all__' ||
    season !== '__all__' || color !== '__all__' || gender !== '__all__' || active !== '__all__' || novinki !== '__all__';

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('catalog.productsOnSite')}</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-500">{t('common.error')}: {error}</p>
            <p className="text-muted-foreground text-sm mt-2">
              Make sure the SSH tunnel is running: ssh -N marais-pg-tunnel
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('catalog.productsOnSite')}</h1>
        <p className="text-muted-foreground">
          {t('catalog.showingProducts')} {products?.length || 0} {t('catalog.ofTotal')} {total} {t('catalog.productsLabel')}
        </p>
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-col gap-3">
        {/* Search + Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('catalog.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Brand */}
          <Select value={brand} onValueChange={(v) => setFilter('brand', v)}>
            <SelectTrigger className={`h-9 w-auto ${brand !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.brand')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.brand')}</SelectItem>
              {(brands || []).map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select value={category} onValueChange={(v) => setFilter('category', v)}>
            <SelectTrigger className={`h-9 w-auto ${category !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.category')}</SelectItem>
              {(categories || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Season */}
          <Select value={season} onValueChange={(v) => setFilter('season', v)}>
            <SelectTrigger className={`h-9 w-auto ${season !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.season')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.season')}</SelectItem>
              {(seasons || []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Color */}
          <Select value={color} onValueChange={(v) => setFilter('color', v)}>
            <SelectTrigger className={`h-9 w-auto ${color !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.color')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.color')}</SelectItem>
              {(colors || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Gender */}
          <Select value={gender} onValueChange={(v) => setFilter('gender', v)}>
            <SelectTrigger className={`h-9 w-auto ${gender !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.gender')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.gender')}</SelectItem>
              <SelectItem value="жен">{t('catalog.female')}</SelectItem>
              <SelectItem value="муж">{t('catalog.male')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Active */}
          <Select value={active} onValueChange={(v) => setFilter('active', v)}>
            <SelectTrigger className={`h-9 w-auto ${active !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.active')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.active')}</SelectItem>
              <SelectItem value="true">{t('catalog.activeOnly')}</SelectItem>
              <SelectItem value="false">{t('catalog.inactiveOnly')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Novinki */}
          <Select value={novinki} onValueChange={(v) => setFilter('novinki', v)}>
            <SelectTrigger className={`h-9 w-auto ${novinki !== '__all__' ? 'border-primary' : ''}`}>
              <SelectValue placeholder={t('catalog.new')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('catalog.new')}</SelectItem>
              <SelectItem value="true">{t('catalog.novinki')}</SelectItem>
              <SelectItem value="false">{t('catalog.notNovinki')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-muted-foreground"
              onClick={resetFilters}
            >
              <FilterX className="h-4 w-4 mr-1" />
              {t('common.reset')}
            </Button>
          )}
        </div>

        {/* Active Filters Badges */}
        {(brand !== '__all__' || category !== '__all__' || season !== '__all__' || color !== '__all__' || gender !== '__all__' || active !== '__all__' || novinki !== '__all__') && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">{t('common.activeFilters')}:</span>
            {brand !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {brand}
                <button onClick={() => setFilter('brand', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {category !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {category}
                <button onClick={() => setFilter('category', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {season !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {season}
                <button onClick={() => setFilter('season', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {color !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {color}
                <button onClick={() => setFilter('color', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {gender !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {gender === 'жен' ? t('catalog.female') : t('catalog.male')}
                <button onClick={() => setFilter('gender', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {active !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {active === 'true' ? t('catalog.activeOnly') : t('catalog.inactiveOnly')}
                <button onClick={() => setFilter('active', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {novinki !== '__all__' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {novinki === 'true' ? t('catalog.novinki') : t('catalog.notNovinki')}
                <button onClick={() => setFilter('novinki', '__all__')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t('catalog.image')}</TableHead>
                  <TableHead>{t('catalog.sku')}</TableHead>
                  <TableHead>{t('catalog.brand')}</TableHead>
                  <TableHead>{t('catalog.category')}</TableHead>
                  <TableHead>{t('catalog.season')}</TableHead>
                  <TableHead>{t('catalog.gender')}</TableHead>
                  <TableHead className="text-right">{t('catalog.price')}</TableHead>
                  <TableHead className="text-right">{t('catalog.salePrice')}</TableHead>
                  <TableHead className="text-center">{t('catalog.active')}</TableHead>
                  <TableHead className="text-center">{t('catalog.new')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (products?.length || 0) === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-12 w-12 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (products?.length || 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      {t('catalog.noProducts')}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setSheetOpen(true);
                      }}
                    >
                      {/* Image */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {product.main_image ? (
                          <ImageZoom
                            src={product.main_image}
                            alt={product.name}
                            thumbnailClassName="rounded"
                            thumbnailSize={48}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>

                      {/* SKU */}
                      <TableCell className="font-mono text-xs">
                        {product.sku || '-'}
                      </TableCell>

                      {/* Brand */}
                      <TableCell>{product.manufacturer_name || '-'}</TableCell>

                      {/* Category */}
                      <TableCell>{product.category_airtable || '-'}</TableCell>

                      {/* Season */}
                      <TableCell>{product.season || '-'}</TableCell>

                      {/* Gender */}
                      <TableCell>
                        {product.gender === 'жен' ? t('catalog.female') :
                         product.gender === 'муж' ? t('catalog.male') : '-'}
                      </TableCell>

                      {/* Price */}
                      <TableCell className="text-right">
                        {product.price ? `${Math.round(parseFloat(product.price)).toLocaleString()} ₽` : '-'}
                      </TableCell>

                      {/* Sale Price */}
                      <TableCell className="text-right">
                        {product.sale && product.sale_price ? (
                          <span className="text-green-500">
                            {Math.round(parseFloat(product.sale_price)).toLocaleString()} ₽
                          </span>
                        ) : '-'}
                      </TableCell>

                      {/* Active */}
                      <TableCell className="text-center">
                        {product.active ? (
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </TableCell>

                      {/* Novinki */}
                      <TableCell className="text-center">
                        {product.novinki && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 border-yellow-500 text-yellow-500 font-semibold">
                            NEW
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Load More */}
          {(products?.length || 0) < total && (
            <div className="p-4 border-t flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? t('catalog.loading') : `${t('catalog.loadMore')} (${total - (products?.length || 0)} ${t('yandexDirect.remaining')})`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        productId={selectedProductId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
