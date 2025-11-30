'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import type { Task } from './types';

interface TasksCardProps {
  tasks: Task[];
  updatingTasks: Set<string>;
  onToggle: (taskKey: Task['key'], currentValue: number) => void;
  t: (key: string) => string;
}

export function TasksCard({ tasks, updatingTasks, onToggle, t }: TasksCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {t('pipeline.tasks')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.map((task) => {
            const Icon = task.icon;
            const isUpdating = updatingTasks.has(task.key);
            return (
              <button
                key={task.key}
                onClick={() => onToggle(task.key, task.value)}
                disabled={isUpdating}
                className={`w-full flex items-center gap-2 p-2 rounded-md border transition-colors text-sm ${
                  task.value
                    ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                    : 'bg-muted/30 border-transparent hover:bg-muted/50'
                } disabled:opacity-50`}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : task.value ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={task.value ? 'font-medium' : 'text-muted-foreground'}>
                  {task.label}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
