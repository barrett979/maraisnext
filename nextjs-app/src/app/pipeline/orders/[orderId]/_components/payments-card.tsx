'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Calendar, Plus, TrendingUp, List, Percent } from 'lucide-react';
import { ProgressWidget } from './progress-widget';
import { formatDate, formatCurrency } from './utils';
import type { PipelinePayment } from './types';

interface PaymentStats {
  paid: number;
  total: number;
  remaining: number;
  discountAmount: number;
  discountPercent: number;
}

interface PaymentsCardProps {
  payments: PipelinePayment[];
  paymentStats: PaymentStats;
  locale: string;
  onAddPayment: () => void;
  t: (key: string) => string;
}

export function PaymentsCard({
  payments,
  paymentStats,
  locale,
  onAddPayment,
  t,
}: PaymentsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('pipeline.payments')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onAddPayment}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="progress" className="text-xs gap-1">
              <TrendingUp className="h-3 w-3" />
              {t('pipeline.progress')}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1">
              <List className="h-3 w-3" />
              {t('pipeline.history')} ({payments.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="progress" className="mt-4 space-y-4">
            <ProgressWidget
              label={t('pipeline.paymentProgress')}
              current={paymentStats.paid}
              total={paymentStats.total}
              currentLabel={t('pipeline.totalPaid')}
              totalLabel={t('pipeline.total')}
              color="bg-emerald-500"
              formatValue={formatCurrency}
            />
            {paymentStats.discountPercent > 0 && (
              <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md p-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Percent className="h-3 w-3" />
                  {t('pipeline.discount')} ({paymentStats.discountPercent}%)
                </span>
                <span className="font-medium text-green-500">-{formatCurrency(paymentStats.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('pipeline.remaining')}</span>
              <span className={`text-lg font-bold ${paymentStats.remaining === 0 ? 'text-green-500' : 'text-orange-500'}`}>
                {formatCurrency(paymentStats.remaining)}
              </span>
            </div>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('common.noData')}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-2 rounded-md border bg-muted/30 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium shrink-0">
                        {formatDate(payment.payment_date, locale)}
                      </span>
                      {payment.payment_details && (
                        <span className="text-muted-foreground truncate" title={payment.payment_details}>
                          {payment.payment_details}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-green-500 shrink-0 ml-2">
                      +{formatCurrency(payment.amount_eur || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
