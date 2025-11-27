'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';

const PERIOD_OPTIONS = [
  { value: '7', labelKey: 'filters.last7days' },
  { value: '14', labelKey: 'filters.last14days' },
  { value: '30', labelKey: 'filters.last30days' },
  { value: '60', labelKey: 'filters.last60days' },
  { value: '90', labelKey: 'filters.last90days' },
  { value: '180', labelKey: 'filters.last180days' },
];

interface PageFiltersProps {
  days: string;
  onDaysChange: (days: string) => void;
  campaign?: string;
  onCampaignChange?: (campaign: string) => void;
  campaigns?: string[];
  showCampaignFilter?: boolean;
  className?: string;
}

export function PageFilters({
  days,
  onDaysChange,
  campaign,
  onCampaignChange,
  campaigns = [],
  showCampaignFilter = false,
  className = '',
}: PageFiltersProps) {
  const { t } = useI18n();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={days} onValueChange={onDaysChange}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder={t('filters.days')} />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCampaignFilter && onCampaignChange && (
        <Select value={campaign || '__all__'} onValueChange={onCampaignChange}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder={t('filters.selectCampaign')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('filters.allCampaigns')}</SelectItem>
            {campaigns.map(c => (
              <SelectItem key={c} value={c}>
                <span className="truncate max-w-[180px] block">{c}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// Hook per gestire i filtri locali con fetch delle campagne
export function useLocalFilters(options?: { fetchCampaigns?: boolean }) {
  const [days, setDays] = useState('30');
  const [campaign, setCampaign] = useState('__all__');
  const [campaigns, setCampaigns] = useState<string[]>([]);

  useEffect(() => {
    if (options?.fetchCampaigns) {
      fetch('/api/campaigns')
        .then(res => res.json())
        .then(data => setCampaigns(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [options?.fetchCampaigns]);

  return {
    days,
    setDays,
    campaign,
    setCampaign,
    campaigns,
  };
}
