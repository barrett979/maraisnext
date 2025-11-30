'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Paperclip, FileText, ExternalLink, Trash2, Upload, Loader2 } from 'lucide-react';
import { ImageZoom } from '@/components/image-zoom';
import type { InvoiceInfo } from './types';

interface InvoicesCardProps {
  invoices: InvoiceInfo[];
  uploadingInvoice: boolean;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (filename: string) => void;
  t: (key: string) => string;
}

export function InvoicesCard({
  invoices,
  uploadingInvoice,
  onUpload,
  onDelete,
  t,
}: InvoicesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            {t('pipeline.invoices')} ({invoices.length})
          </CardTitle>
          <div className="relative">
            <input
              type="file"
              id="invoice-upload"
              className="sr-only"
              onChange={onUpload}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              disabled={uploadingInvoice}
            />
            <label htmlFor="invoice-upload">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={uploadingInvoice}
                asChild
              >
                <span>
                  {uploadingInvoice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </span>
              </Button>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('common.noData')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
            {invoices.map((invoice, idx) => {
              const isImage = invoice.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(invoice.filename);

              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  {isImage ? (
                    <ImageZoom
                      src={invoice.url}
                      alt={invoice.filename}
                      thumbnailClassName="w-8 h-8 object-cover rounded"
                      thumbnailSize={32}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="flex-1 text-sm truncate" title={invoice.filename}>
                    {invoice.filename}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={invoice.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>{t('catalog.openOnSite')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <button
                    onClick={() => onDelete(invoice.filename)}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
