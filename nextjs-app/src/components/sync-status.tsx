'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SyncStatus {
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string | null;
  last_sync_records: number;
  sync_in_progress: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'adesso';
  if (diffMins < 60) return `${diffMins}m fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  return `${diffDays}g fa`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      setStatus(data);
    } catch {
      // Ignore errors
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (syncing || status?.sync_in_progress) return;
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      // Poll more frequently during sync
      const pollInterval = setInterval(async () => {
        const res = await fetch('/api/sync');
        const data = await res.json();
        setStatus(data);
        if (!data.sync_in_progress) {
          clearInterval(pollInterval);
          setSyncing(false);
        }
      }, 2000);
    } catch {
      setSyncing(false);
    }
  };

  const isInProgress = syncing || status?.sync_in_progress;

  if (!status) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Caricamento...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleManualSync}
            disabled={isInProgress}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors',
              'hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed',
              status.last_sync_status === 'error'
                ? 'text-red-400'
                : 'text-muted-foreground'
            )}
          >
            {isInProgress ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Sync in corso...</span>
              </>
            ) : status.last_sync_status === 'error' ? (
              <>
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Errore sync</span>
              </>
            ) : status.last_sync_at ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span>Aggiornato {formatRelativeTime(status.last_sync_at)}</span>
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" />
                <span>Mai sincronizzato</span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {status.last_sync_at ? (
            <div className="space-y-1">
              <p>Ultimo sync: {formatDateTime(status.last_sync_at)}</p>
              {status.last_sync_records > 0 && (
                <p>{status.last_sync_records.toLocaleString()} record aggiornati</p>
              )}
              {status.last_sync_error && (
                <p className="text-red-400">Errore: {status.last_sync_error}</p>
              )}
              <p className="text-muted-foreground mt-1">Click per sincronizzare manualmente</p>
            </div>
          ) : (
            <p>Click per avviare la prima sincronizzazione</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
