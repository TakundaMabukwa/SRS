/**
 * Custom hooks for video alert management
 */

import { useState, useEffect, useCallback } from "react";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import type { AlertFilters, AlertSeverity, AlertStatus } from "@/types/video-alerts";

/**
 * Hook for managing alert filters
 */
export const useAlertFilters = () => {
  const { filters, setFilters, clearFilters } = useVideoAlerts();

  const updateFilter = useCallback((key: keyof AlertFilters, value: any) => {
    setFilters({ [key]: value });
  }, [setFilters]);

  const updateMultipleFilters = useCallback((newFilters: Partial<AlertFilters>) => {
    setFilters(newFilters);
  }, [setFilters]);

  const resetFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  return {
    filters,
    updateFilter,
    updateMultipleFilters,
    resetFilters,
  };
};

/**
 * Hook for real-time screenshot refresh
 * Auto-refreshes screenshots every 30 seconds for active alerts
 */
export const useAutoRefreshScreenshots = (
  alertId: string | null,
  enabled: boolean = true
) => {
  const { refreshScreenshots, selectedAlert } = useVideoAlerts();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (!alertId || !enabled || selectedAlert?.status === "closed") {
      return;
    }

    // Initial refresh
    refreshScreenshots(alertId);
    setLastRefresh(new Date());

    // Set up interval for 30 seconds
    const interval = setInterval(() => {
      refreshScreenshots(alertId);
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [alertId, enabled, selectedAlert?.status, refreshScreenshots]);

  return { lastRefresh };
};

/**
 * Hook for alert statistics
 */
export const useAlertStatistics = (dateFrom?: string, dateTo?: string) => {
  const { statistics, fetchStatistics } = useVideoAlerts();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadStatistics = async () => {
      setLoading(true);
      await fetchStatistics(dateFrom, dateTo);
      setLoading(false);
    };

    loadStatistics();
  }, [dateFrom, dateTo, fetchStatistics]);

  return { statistics, loading };
};

/**
 * Hook for alert severity badge configuration
 */
export const useAlertSeverityBadge = (severity: AlertSeverity) => {
  const getBadgeConfig = useCallback(() => {
    const configs = {
      critical: {
        color: "bg-red-100 text-red-800 border-red-300",
        label: "Critical",
        priority: 1,
      },
      high: {
        color: "bg-orange-100 text-orange-800 border-orange-300",
        label: "High",
        priority: 2,
      },
      medium: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        label: "Medium",
        priority: 3,
      },
      low: {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        label: "Low",
        priority: 4,
      },
      info: {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        label: "Info",
        priority: 5,
      },
    };
    return configs[severity] || configs.info;
  }, [severity]);

  return getBadgeConfig();
};

/**
 * Hook for alert status badge configuration
 */
export const useAlertStatusBadge = (status: AlertStatus) => {
  const getBadgeConfig = useCallback(() => {
    const configs = {
      new: {
        color: "bg-purple-100 text-purple-800 border-purple-300",
        label: "New",
        dot: "bg-purple-500",
      },
      acknowledged: {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        label: "Acknowledged",
        dot: "bg-blue-500",
      },
      investigating: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        label: "Investigating",
        dot: "bg-yellow-500",
      },
      escalated: {
        color: "bg-red-100 text-red-800 border-red-300",
        label: "Escalated",
        dot: "bg-red-500",
      },
      resolved: {
        color: "bg-green-100 text-green-800 border-green-300",
        label: "Resolved",
        dot: "bg-green-500",
      },
      closed: {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        label: "Closed",
        dot: "bg-gray-500",
      },
    };
    return configs[status] || configs.new;
  }, [status]);

  return getBadgeConfig();
};

/**
 * Hook for managing alert actions
 */
export const useAlertActions = (alertId: string) => {
  const {
    acknowledgeAlert,
    updateAlertStatus,
    addNote,
    escalateAlert,
    closeAlert,
    assignAlert,
  } = useVideoAlerts();
  const [currentUser] = useState({ id: "user-1", name: "Current User" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAcknowledge = useCallback(async () => {
    setActionLoading("acknowledge");
    const result = await acknowledgeAlert(alertId, currentUser.id);
    setActionLoading(null);
    return result;
  }, [alertId, acknowledgeAlert, currentUser.id]);

  const handleStatusChange = useCallback(async (newStatus: AlertStatus) => {
    setActionLoading("status");
    const result = await updateAlertStatus(alertId, newStatus, currentUser.id);
    setActionLoading(null);
    return result;
  }, [alertId, updateAlertStatus, currentUser.id]);

  const handleAddNote = useCallback(async (content: string, isInternal: boolean = false) => {
    setActionLoading("note");
    const result = await addNote(alertId, {
      content,
      user_id: currentUser.id,
      user_name: currentUser.name,
      is_internal: isInternal,
    });
    setActionLoading(null);
    return result;
  }, [alertId, addNote, currentUser]);

  const handleEscalate = useCallback(async (escalateToId: string, reason: string) => {
    setActionLoading("escalate");
    const result = await escalateAlert(alertId, {
      escalate_to: escalateToId,
      reason,
    });
    setActionLoading(null);
    return result;
  }, [alertId, escalateAlert]);

  const handleClose = useCallback(async (closingNotes: string, actionTaken?: string) => {
    setActionLoading("close");
    const result = await closeAlert(alertId, {
      closing_notes: closingNotes,
      action_taken: actionTaken,
    });
    setActionLoading(null);
    return result;
  }, [alertId, closeAlert]);

  const handleAssign = useCallback(async (assignedToId: string) => {
    setActionLoading("assign");
    const result = await assignAlert(alertId, currentUser.id, assignedToId);
    setActionLoading(null);
    return result;
  }, [alertId, assignAlert, currentUser.id]);

  return {
    handleAcknowledge,
    handleStatusChange,
    handleAddNote,
    handleEscalate,
    handleClose,
    handleAssign,
    actionLoading,
  };
};

/**
 * Hook for real-time alert notifications
 * This would integrate with WebSocket or Server-Sent Events in production
 */
export const useRealtimeAlerts = (enabled: boolean = true) => {
  const { onRealtimeAlert, onRealtimeAlertUpdate, fetchUnreadCount } = useVideoAlerts();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // In production, connect to WebSocket/SSE here
    // For now, we'll simulate with polling
    setConnected(true);

    // Placeholder for real-time connection
    // const ws = new WebSocket('ws://your-backend/alerts');
    // ws.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   if (data.type === 'new_alert') {
    //     onRealtimeAlert(data.alert);
    //   } else if (data.type === 'alert_updated') {
    //     onRealtimeAlertUpdate(data.alert);
    //   }
    // };

    return () => {
      setConnected(false);
      // ws.close();
    };
  }, [enabled, onRealtimeAlert, onRealtimeAlertUpdate]);

  return { connected };
};

/**
 * Hook for alert escalation rules
 */
export const useAlertEscalation = (alertId: string) => {
  const { selectedAlert } = useVideoAlerts();
  const [shouldEscalate, setShouldEscalate] = useState(false);

  useEffect(() => {
    if (!selectedAlert) return;

    // Check if alert should be escalated based on time and severity
    const createdAt = new Date(selectedAlert.timestamp);
    const now = new Date();
    const minutesSinceCreated = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    // Escalation rules (customize as needed)
    const escalationThresholds = {
      critical: 5,  // 5 minutes
      high: 15,     // 15 minutes
      medium: 30,   // 30 minutes
      low: 60,      // 60 minutes
      info: 120,    // 120 minutes
    };

    const threshold = escalationThresholds[selectedAlert.severity];
    
    if (
      !selectedAlert.escalated &&
      selectedAlert.status !== "resolved" &&
      selectedAlert.status !== "closed" &&
      minutesSinceCreated > threshold
    ) {
      setShouldEscalate(true);
    } else {
      setShouldEscalate(false);
    }
  }, [selectedAlert]);

  return { shouldEscalate };
};
