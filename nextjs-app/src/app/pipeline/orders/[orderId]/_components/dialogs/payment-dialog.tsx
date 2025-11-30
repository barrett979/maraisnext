'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { formatDate } from '../utils';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentDate: Date | undefined;
  onPaymentDateChange: (date: Date | undefined) => void;
  paymentAmount: string;
  onPaymentAmountChange: (value: string) => void;
  paymentDetails: string;
  onPaymentDetailsChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
  locale: string;
  t: (key: string) => string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  paymentDate,
  onPaymentDateChange,
  paymentAmount,
  onPaymentAmountChange,
  paymentDetails,
  onPaymentDetailsChange,
  saving,
  onSave,
  locale,
  t,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pipeline.addPayment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('pipeline.paymentDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? formatDate(paymentDate.toISOString().split('T')[0], locale) : t('pipeline.selectDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={paymentDate}
                  onSelect={onPaymentDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.amount')} (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => onPaymentAmountChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.paymentDetails')}</Label>
            <Input
              type="text"
              placeholder={t('pipeline.paymentDetailsPlaceholder')}
              value={paymentDetails}
              onChange={(e) => onPaymentDetailsChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !paymentDate || !paymentAmount}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
