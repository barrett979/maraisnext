'use client';

import { Progress } from '@/components/ui/progress';

interface ProgressWidgetProps {
  label: string;
  current: number;
  total: number;
  currentLabel: string;
  totalLabel: string;
  color?: string;
  formatValue?: (value: number) => string;
}

export function ProgressWidget({
  label,
  current,
  total,
  currentLabel,
  totalLabel,
  color = 'bg-primary',
  formatValue = (v: number) => String(v),
}: ProgressWidgetProps) {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const isComplete = current >= total && total > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs font-medium ${isComplete ? 'text-green-500' : 'text-muted-foreground'}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="relative">
        <Progress
          value={percentage}
          className={`h-3 ${isComplete ? '[&>div]:bg-green-500' : `[&>div]:${color}`}`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentLabel}: <span className="font-medium text-foreground">{formatValue(current)}</span></span>
        <span>{totalLabel}: <span className="font-medium text-foreground">{formatValue(total)}</span></span>
      </div>
    </div>
  );
}
