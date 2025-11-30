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

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: string;
  onSeasonChange: (value: string) => void;
  orderDate: Date | undefined;
  onOrderDateChange: (date: Date | undefined) => void;
  expectedDelivery: Date | undefined;
  onExpectedDeliveryChange: (date: Date | undefined) => void;
  country: string;
  onCountryChange: (value: string) => void;
  gender: string;
  onGenderChange: (value: string) => void;
  product: string;
  onProductChange: (value: string) => void;
  discount: string;
  onDiscountChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
  locale: string;
  t: (key: string) => string;
}

export function EditOrderDialog({
  open,
  onOpenChange,
  season,
  onSeasonChange,
  orderDate,
  onOrderDateChange,
  expectedDelivery,
  onExpectedDeliveryChange,
  country,
  onCountryChange,
  gender,
  onGenderChange,
  product,
  onProductChange,
  discount,
  onDiscountChange,
  notes,
  onNotesChange,
  saving,
  onSave,
  locale,
  t,
}: EditOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pipeline.editOrder')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('pipeline.season')}</Label>
            <Input
              type="text"
              placeholder="FW25, SS25..."
              value={season}
              onChange={(e) => onSeasonChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.orderDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {orderDate ? formatDate(orderDate.toISOString().split('T')[0], locale) : t('pipeline.selectDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={orderDate}
                  onSelect={onOrderDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.expectedDelivery')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedDelivery ? formatDate(expectedDelivery.toISOString().split('T')[0], locale) : t('pipeline.selectDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={expectedDelivery}
                  onSelect={onExpectedDeliveryChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.country')}</Label>
            <Input
              type="text"
              placeholder="Italia, Cina..."
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.gender')}</Label>
            <Input
              type="text"
              placeholder="Donna, Uomo..."
              value={gender}
              onChange={(e) => onGenderChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.productType')}</Label>
            <Input
              type="text"
              placeholder="Scarpe, Borse..."
              value={product}
              onChange={(e) => onProductChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.discount')} (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={discount}
              onChange={(e) => onDiscountChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('pipeline.notes')}</Label>
            <Input
              type="text"
              placeholder={t('pipeline.notesPlaceholder')}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
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
