'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Check, X, Sparkles, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ImageZoom } from '@/components/image-zoom';

interface ProductDetail {
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
  date_created: string | null;
  date_updated: string | null;
}

interface ProductImage {
  id: number;
  url: string;
  is_main: boolean;
  position: number | null;
  width: number | null;
  height: number | null;
}

interface ProductAttribute {
  attribute_name: string;
  attribute_value: string;
}

interface ProductDetailSheetProps {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailSheet({
  productId,
  open,
  onOpenChange,
}: ProductDetailSheetProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);

  useEffect(() => {
    if (productId && open) {
      setLoading(true);
      fetch(`/api/products/${productId}`)
        .then((res) => res.json())
        .then((data) => {
          setProduct(data.product);
          setImages(data.images || []);
          setAttributes(data.attributes || []);
        })
        .catch((err) => {
          console.error('Failed to fetch product details:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [productId, open]);

  // Clear data when closing
  useEffect(() => {
    if (!open) {
      setProduct(null);
      setImages([]);
      setAttributes([]);
    }
  }, [open]);

  // Strip HTML from description
  const stripHtml = (html: string | null): string => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  };

  // Parse description to extract specs table (e.g., "Артикул: XXX Высота каблука: 4,5 ...")
  const parseDescription = (html: string | null): { description: string; specs: Record<string, string> } => {
    const text = stripHtml(html);
    const specs: Record<string, string> = {};

    // Known spec keys in Russian
    const specKeys = [
      'Артикул',
      'Высота каблука',
      'Высота платформы',
      'Высота голенища',
      'Материал верха',
      'Материал стельки',
      'Материал подошвы',
      'Материал подкладки',
      'Страна производства',
      'Состав',
      'Цвет',
    ];

    // Build regex pattern to match specs
    const pattern = new RegExp(`(${specKeys.join('|')}):\\s*([^:]+?)(?=(?:${specKeys.join('|')})|$)`, 'gi');

    let cleanDescription = text;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (value) {
        specs[key] = value;
      }
    }

    // Remove specs from description
    if (Object.keys(specs).length > 0) {
      // Find where specs start (first occurrence of any spec key followed by :)
      const firstSpecPattern = new RegExp(`\\s*(${specKeys.join('|')}):`);
      const firstSpecMatch = cleanDescription.match(firstSpecPattern);
      if (firstSpecMatch && firstSpecMatch.index !== undefined) {
        cleanDescription = cleanDescription.substring(0, firstSpecMatch.index).trim();
      }
    }

    return { description: cleanDescription, specs };
  };

  // Build product URL on marais.ru
  const getProductUrl = (slug: string): string => {
    return `https://www.marais.ru/product/${slug}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full">
        <SheetHeader className="px-6 pt-6 pb-4 pr-12 space-y-3">
          <SheetTitle className="text-left">
            {loading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              product?.name || t('catalog.loading')
            )}
          </SheetTitle>
          {product?.sku && (
            <SheetDescription className="text-left font-mono">
              SKU: {product.sku}
            </SheetDescription>
          )}
          {/* Status Badges */}
          {product && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={product.active ? 'default' : 'secondary'}>
                {product.active ? (
                  <><Check className="h-3 w-3 mr-1" /> {t('catalog.activeOnly')}</>
                ) : (
                  <><X className="h-3 w-3 mr-1" /> {t('catalog.inactiveOnly')}</>
                )}
              </Badge>
              {product.novinki && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  <Sparkles className="h-3 w-3 mr-1" /> {t('catalog.novinki')}
                </Badge>
              )}
              {product.sale && (
                <Badge variant="destructive">{t('catalog.sale')}</Badge>
              )}
            </div>
          )}
          {/* Open on site button */}
          {product?.slug && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <a
                href={getProductUrl(product.slug)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('catalog.openOnSite')}
              </a>
            </Button>
          )}
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 h-0">
          <div className="px-6 py-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : product ? (
              <div className="space-y-6">
                {/* Images Gallery */}
                <section className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t('catalog.image')} ({images.length})
                  </h3>
                  {images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((img, index) => (
                        <div key={img.id} className="relative">
                          <ImageZoom
                            src={img.url}
                            alt={`${product.name} - ${index + 1}`}
                            thumbnailClassName="rounded-md aspect-square w-full"
                            thumbnailSize={120}
                          />
                          {img.is_main && (
                            <Badge
                              variant="secondary"
                              className="absolute top-1 left-1 text-xs px-1 py-0"
                            >
                              {t('catalog.main')}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-32 bg-muted rounded-md flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </section>

                <Separator />

                {/* Basic Info */}
                <section className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t('catalog.info')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('catalog.brand')}</span>
                      <p className="font-medium">{product.manufacturer_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('catalog.category')}</span>
                      <p className="font-medium">{product.category_airtable || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('catalog.gender')}</span>
                      <p className="font-medium">
                        {product.gender === 'жен' ? t('catalog.female') :
                         product.gender === 'муж' ? t('catalog.male') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('catalog.price')}</span>
                      <p className="font-medium">
                        {product.price ? `${Math.round(parseFloat(product.price)).toLocaleString()} ₽` : '-'}
                      </p>
                    </div>
                    {product.sale && product.sale_price && (
                      <div>
                        <span className="text-muted-foreground">{t('catalog.salePrice')}</span>
                        <p className="font-medium text-green-500">
                          {Math.round(parseFloat(product.sale_price)).toLocaleString()} ₽
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Attributes */}
                {attributes.length > 0 && (
                  <>
                    <Separator />
                    <section className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {t('catalog.attributes')}
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {attributes.map((attr, index) => (
                          <div key={index}>
                            <span className="text-muted-foreground capitalize">
                              {attr.attribute_name}
                            </span>
                            <p className="font-medium">{attr.attribute_value}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* Description & Specs */}
                {product.description && (() => {
                  const { description, specs } = parseDescription(product.description);
                  const hasSpecs = Object.keys(specs).length > 0;

                  return (
                    <>
                      {/* Description Text */}
                      {description && (
                        <>
                          <Separator />
                          <section className="space-y-3">
                            <h3 className="text-sm font-medium text-muted-foreground">
                              {t('catalog.description')}
                            </h3>
                            <p className="text-sm leading-relaxed">
                              {description}
                            </p>
                          </section>
                        </>
                      )}

                      {/* Specs Table */}
                      {hasSpecs && (
                        <>
                          <Separator />
                          <section className="space-y-3">
                            <h3 className="text-sm font-medium text-muted-foreground">
                              {t('catalog.specs')}
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                              {Object.entries(specs).map(([key, value]) => (
                                <div key={key} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                                  <span className="text-muted-foreground">{key}</span>
                                  <span className="font-medium text-right">{value}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Dates */}
                <Separator />
                <section className="text-xs text-muted-foreground space-y-1 pb-4">
                  {product.date_created && (
                    <p>{t('catalog.created')}: {new Date(product.date_created).toLocaleDateString()}</p>
                  )}
                  {product.date_updated && (
                    <p>{t('catalog.updated')}: {new Date(product.date_updated).toLocaleDateString()}</p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
