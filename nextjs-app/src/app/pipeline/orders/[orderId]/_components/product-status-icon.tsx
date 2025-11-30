'use client';

import { Package, Clock, X, CheckCircle, Truck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProductStatusIconProps {
  status: string | null;
  t: (key: string) => string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Package; labelKey: string }> = {
  'in stock': { color: 'text-green-500', icon: Package, labelKey: 'pipeline.statusInStock' },
  'waiting': { color: 'text-yellow-500', icon: Clock, labelKey: 'pipeline.statusWaiting' },
  'canceled': { color: 'text-red-500', icon: X, labelKey: 'pipeline.statusCanceled' },
  'ready': { color: 'text-blue-500', icon: CheckCircle, labelKey: 'pipeline.statusReady' },
  'shipped': { color: 'text-purple-500', icon: Truck, labelKey: 'pipeline.statusShipped' },
};

export function ProductStatusIcon({ status, t }: ProductStatusIconProps) {
  if (!status) return null;

  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-muted-foreground text-xs">{status}</span>;

  const Icon = cfg.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={`h-5 w-5 ${cfg.color}`} />
        </TooltipTrigger>
        <TooltipContent>{t(cfg.labelKey)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { STATUS_CONFIG };
