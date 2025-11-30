'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Package, X, CheckCircle, Truck, Loader2, Trash2 } from 'lucide-react';
import { ImageZoom } from '@/components/image-zoom';
import { ProductStatusIcon, STATUS_CONFIG } from './product-status-icon';
import { formatCurrency } from './utils';
import type { PipelineProduct } from './types';

interface ProductsCardProps {
  products: PipelineProduct[];
  selectedProducts: Set<number>;
  bulkLoading: boolean;
  onToggleProduct: (id: number) => void;
  onToggleAll: () => void;
  onClearSelection: () => void;
  onUpdateStatus: (status: string) => void;
  onDeleteClick: () => void;
  t: (key: string) => string;
}

export function ProductsCard({
  products,
  selectedProducts,
  bulkLoading,
  onToggleProduct,
  onToggleAll,
  onClearSelection,
  onUpdateStatus,
  onDeleteClick,
  t,
}: ProductsCardProps) {
  // Status filter state - all visible by default
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());

  const hasAnyColorImage = useMemo(() => {
    return products.some(p => p.color_image);
  }, [products]);

  const statusCounts = useMemo(() => {
    return products.reduce((acc, p) => {
      const s = p.status || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [products]);

  // Filter products based on hidden statuses
  const filteredProducts = useMemo(() => {
    if (hiddenStatuses.size === 0) return products;
    return products.filter(p => !hiddenStatuses.has(p.status || 'unknown'));
  }, [products, hiddenStatuses]);

  const toggleStatusFilter = (status: string) => {
    setHiddenStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('pipeline.products')} ({products.length})
          </CardTitle>
          <TooltipProvider>
            <div className="flex items-center gap-1 text-sm">
              {Object.entries(statusCounts).map(([status, count]) => {
                const config = STATUS_CONFIG[status];
                if (!config) return null;
                const IconComp = config.icon;
                const isHidden = hiddenStatuses.has(status);
                return (
                  <Tooltip key={status}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleStatusFilter(status)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                          isHidden
                            ? 'opacity-40 line-through bg-muted'
                            : `${config.color} hover:bg-muted`
                        }`}
                      >
                        <IconComp className="h-4 w-4" />
                        <span>{count}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isHidden ? t('pipeline.showStatus') : t('pipeline.hideStatus')}: {t(`pipeline.status.${status}`)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {hiddenStatuses.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setHiddenStatuses(new Set())}
                >
                  {t('pipeline.showAll')}
                </Button>
              )}
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {selectedProducts.size > 0 && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-muted/50 border sticky top-0 z-10">
            <span className="text-sm text-muted-foreground">
              {selectedProducts.size} {t('pipeline.selected')}
            </span>
            <div className="flex-1" />
            {bulkLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateStatus('ready')}
                >
                  <CheckCircle className="h-4 w-4 mr-1 text-blue-500" />
                  {t('pipeline.markAsReady')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateStatus('shipped')}
                >
                  <Truck className="h-4 w-4 mr-1 text-purple-500" />
                  {t('pipeline.markAsShipped')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateStatus('in stock')}
                >
                  <Package className="h-4 w-4 mr-1 text-green-500" />
                  {t('pipeline.markAsInStock')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeleteClick}
                >
                  <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={onToggleAll}
                  />
                </TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-14"></TableHead>
                {hasAnyColorImage && <TableHead className="w-14"></TableHead>}
                <TableHead>{t('catalog.sku')}</TableHead>
                <TableHead>{t('catalog.category')}</TableHead>
                <TableHead>{t('catalog.color')}</TableHead>
                <TableHead className="text-right">{t('pipeline.quantity')}</TableHead>
                <TableHead className="text-right">{t('catalog.price')}</TableHead>
                <TableHead className="text-right">{t('pipeline.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const isCanceled = product.status === 'canceled';
                return (
                  <TableRow
                    key={product.id}
                    className={`${selectedProducts.has(product.id) ? 'bg-muted/50' : ''} ${isCanceled ? 'opacity-50' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => onToggleProduct(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <ProductStatusIcon status={product.status} t={t} />
                    </TableCell>
                    <TableCell>
                      {product.product_image ? (
                        <ImageZoom
                          src={product.product_image}
                          alt={product.supplier_sku || 'Product'}
                          thumbnailClassName={`rounded ${isCanceled ? 'grayscale' : ''}`}
                          thumbnailSize={48}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    {hasAnyColorImage && (
                      <TableCell>
                        {product.color_image ? (
                          <ImageZoom
                            src={product.color_image}
                            alt={product.color || 'Color'}
                            thumbnailClassName={`rounded ${isCanceled ? 'grayscale' : ''}`}
                            thumbnailSize={48}
                          />
                        ) : (
                          <div className="w-12 h-12" />
                        )}
                      </TableCell>
                    )}
                    <TableCell className={`font-mono text-sm ${isCanceled ? 'line-through' : ''}`}>
                      {product.supplier_sku || '-'}
                    </TableCell>
                    <TableCell className={`text-sm ${isCanceled ? 'line-through' : ''}`}>
                      {product.category || '-'}
                    </TableCell>
                    <TableCell className={`text-sm ${isCanceled ? 'line-through' : ''}`}>
                      {product.color || '-'}
                    </TableCell>
                    <TableCell className={`text-right ${isCanceled ? 'line-through' : ''}`}>
                      {product.quantity}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${isCanceled ? 'line-through' : ''}`}>
                      {formatCurrency(product.wholesale_price)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${isCanceled ? 'line-through' : ''}`}>
                      {formatCurrency(product.wholesale_price * product.quantity)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
