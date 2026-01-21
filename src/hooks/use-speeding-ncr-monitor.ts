"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useSpeedingNCRMonitor(driverId?: string) {
  const { toast } = useToast();

  useEffect(() => {
    if (!driverId) return;

    const checkSpeedingEvents = async () => {
      try {
        const res = await fetch(`/api/video-server/drivers/${driverId}/speeding-events?days=30`);
        if (res.ok) {
          const data = await res.json();
          
          if (data.success && data.events && data.events.length >= 3) {
            const ncrRes = await fetch('/api/ncr/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                driverId,
                speedingEvents: data.events,
              }),
            });

            if (ncrRes.ok) {
              const ncrData = await ncrRes.json();
              toast({
                title: "NCR Auto-Generated",
                description: `${ncrData.message}`,
                variant: "destructive",
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to check speeding events:', err);
      }
    };

    checkSpeedingEvents();
    const interval = setInterval(checkSpeedingEvents, 300000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [driverId, toast]);
}
