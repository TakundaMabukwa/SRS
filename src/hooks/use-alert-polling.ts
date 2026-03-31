"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AlertStats {
  newCount: number;
  criticalCount: number;
  unattendedCount: number;
}

async function readJsonSafely(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response');
  }
}

export function useAlertPolling() {
  const [stats, setStats] = useState<AlertStats>({ newCount: 0, criticalCount: 0, unattendedCount: 0 });
  const [lastAlertCount, setLastAlertCount] = useState(0);
  const { toast } = useToast();

  const fetchActiveAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/video-server/alerts/active');
      if (res.ok) {
        const data = await readJsonSafely(res);
        if (data.success && data.alerts) {
          const newCount = data.alerts.filter((a: any) => a.status === 'new').length;
          const criticalCount = data.alerts.filter((a: any) => a.priority === 'critical').length;
          
          if (newCount > lastAlertCount) {
            toast({
              title: "New Alert",
              description: `${newCount - lastAlertCount} new alert(s) received`,
              variant: "destructive",
            });
          }
          
          setLastAlertCount(newCount);
          setStats(prev => ({ ...prev, newCount, criticalCount }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch active alerts:', err);
    }
  }, [lastAlertCount, toast]);

  const fetchUnattendedAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/video-server/alerts/unattended?minutes=30');
      if (res.ok) {
        const data = await readJsonSafely(res);
        if (data.success && data.count > 0) {
          setStats(prev => ({ ...prev, unattendedCount: data.count }));
          
          if (data.count > 3) {
            toast({
              title: "Unattended Alerts",
              description: `${data.count} alerts need attention!`,
              variant: "destructive",
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch unattended alerts:', err);
    }
  }, [toast]);

  useEffect(() => {
    fetchActiveAlerts();
    fetchUnattendedAlerts();

    const activeInterval = setInterval(fetchActiveAlerts, 10000);
    const unattendedInterval = setInterval(fetchUnattendedAlerts, 60000);

    return () => {
      clearInterval(activeInterval);
      clearInterval(unattendedInterval);
    };
  }, [fetchActiveAlerts, fetchUnattendedAlerts]);

  return stats;
}
