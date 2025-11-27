'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PERIOD_OPTIONS = [
  { value: '7', label: '7 giorni' },
  { value: '14', label: '14 giorni' },
  { value: '30', label: '30 giorni' },
  { value: '60', label: '60 giorni' },
  { value: '90', label: '90 giorni' },
  { value: '180', label: '180 giorni' },
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
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={days} onValueChange={onDaysChange}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCampaignFilter && onCampaignChange && (
        <Select value={campaign || '__all__'} onValueChange={onCampaignChange}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Tutte le campagne" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutte le campagne</SelectItem>
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
