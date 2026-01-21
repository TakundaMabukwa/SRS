/**
 * Video Alerts Context
 * Main context provider for video alert management
 */

"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { videoAlertsReducer, initialState } from "./reducer";
import * as actions from "./actions";
import * as api from "./api";
import { useToast } from "@/hooks/use-toast";

const VideoAlertsContext = createContext();

export const useVideoAlerts = () => {
  const context = useContext(VideoAlertsContext);
  if (!context) {
    throw new Error("useVideoAlerts must be used within VideoAlertsProvider");
  }
  return context;
};

export const VideoAlertsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(videoAlertsReducer, initialState);
  const { toast } = useToast();

  // Load initial data on mount
  useEffect(() => {
    dispatch(actions.setLoading(false));
  }, []);

  const fetchAlerts = useCallback(async (filters = {}) => {
    dispatch(actions.setLoading(true));
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.limit) params.append('limit', filters.limit);
      
      const response = await fetch(`/api/video-server/alerts?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.alerts) {
          const alertsWithPlates = await Promise.all(
            data.alerts.map(async function(alert) {
              try {
                const plateRes = await fetch(`/api/vehicle-lookup?deviceId=${alert.device_id}`);
                if (plateRes.ok) {
                  const plateData = await plateRes.json();
                  if (plateData.success) {
                    return { ...alert, vehicle_registration: plateData.plate, fleet_number: plateData.fleetNumber };
                  }
                }
              } catch (e) {}
              return alert;
            })
          );
          dispatch(actions.fetchAlerts({ data: alertsWithPlates, statistics: { total: data.count } }));
          dispatch(actions.setLoading(false));
          return;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      dispatch(actions.setError('Video server unavailable'));
      dispatch(actions.setLoading(false));
    }
  }, [toast]);

  const fetchAlert = useCallback(async (alertId) => {
    dispatch(actions.setLoading(true));
    try {
      const response = await fetch(`/api/video-server/alerts/${alertId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.alert) {
          dispatch(actions.fetchAlert(data.alert));
          dispatch(actions.setLoading(false));
          return data.alert;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      dispatch(actions.setError('Alert not found'));
      dispatch(actions.setLoading(false));
      return null;
    }
  }, [toast]);

  const acknowledgeAlert = useCallback(async (alertId, userId) => {
    try {
      const response = await fetch(`/api/video-server/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy: userId })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          dispatch(actions.acknowledgeAlert(alertId, data.alert || {}));
          toast({ title: "Success", description: "Alert acknowledged" });
          return data.alert;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      toast({ title: "Error", description: "Failed to acknowledge alert", variant: "destructive" });
      return null;
    }
  }, [toast]);

  const updateAlertStatus = useCallback(async (alertId, newStatus, userId, details = {}) => {
    try {
      let endpoint = `/api/video-server/alerts/${alertId}/acknowledge`;
      let body = { acknowledgedBy: userId };
      
      if (newStatus === 'resolved') {
        endpoint = `/api/video-server/alerts/${alertId}/resolve-with-notes`;
        body = { notes: details.notes || 'Resolved', resolvedBy: userId };
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          dispatch(actions.updateAlertStatus(alertId, newStatus, data.alert || {}));
          toast({ title: "Success", description: `Alert status updated to ${newStatus}` });
          return data.alert;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      toast({ title: "Error", description: "Failed to update alert status", variant: "destructive" });
      return null;
    }
  }, [toast]);

  const addNote = useCallback(async (alertId, noteData) => {
    try {
      const response = await fetch(`/api/video-server/alerts/${alertId}/resolve-with-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteData.note, resolvedBy: noteData.userId })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          dispatch(actions.addNote(alertId, { note: noteData.note, userId: noteData.userId }));
          toast({ title: "Success", description: "Note added to alert" });
          return data.alert;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
      return null;
    }
  }, [toast]);

  const escalateAlert = useCallback(async (alertId, escalationData) => {
    try {
      const response = await fetch(`/api/video-server/alerts/${alertId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: escalationData.reason || 'Escalated by operator' })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          dispatch(actions.escalateAlert(alertId, data.alert || {}));
          toast({ title: "Alert Escalated", description: "Alert escalated to management" });
          return data.alert;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      toast({ title: "Error", description: "Failed to escalate alert", variant: "destructive" });
      return null;
    }
  }, [toast]);

  const closeAlert = useCallback(async (alertId, closingData) => {
    try {
      const response = await fetch(`/api/video-server/alerts/${alertId}/resolve-with-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: closingData.notes, resolvedBy: closingData.userId })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          dispatch(actions.closeAlert(alertId, data.alert || {}));
          toast({ title: "Alert Closed", description: "Alert has been successfully closed" });
          return data.alert;
        }
      }
      throw new Error('API failed');
    } catch (error) {
      toast({ title: "Error", description: "Failed to close alert", variant: "destructive" });
      return null;
    }
  }, [toast]);

  const refreshScreenshots = useCallback(async (alertId) => {
    try {
      const response = await fetch(`/api/video-server/screenshots/recent?limit=50`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.screenshots) {
          const alertScreenshots = data.screenshots.filter(s => s.alert_id === alertId);
          dispatch(actions.refreshScreenshots(alertId, alertScreenshots));
          return alertScreenshots;
        }
      }
    } catch (error) {
      console.error('Failed to refresh screenshots:', error);
    }
    return null;
  }, []);

  const fetchStatistics = useCallback(async (dateFrom, dateTo) => {
    try {
      const response = await fetch('/api/video-server/alerts/stats');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          dispatch(actions.fetchStatistics(data.stats));
          return data.stats;
        }
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
    return null;
  }, []);

  const fetchUnreadCount = useCallback(async (userId) => {
    // Unread count will be calculated from alerts list
    return 0;
  }, []);

  // Set filters
  const setFilters = useCallback((filters) => {
    dispatch(actions.setFilters(filters));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    dispatch(actions.clearFilters());
  }, []);

  // Assign alert
  const assignAlert = useCallback(async (alertId, userId, assignedToId) => {
    try {
      const response = await api.assignAlertAPI(alertId, userId, assignedToId);
      dispatch(actions.updateAlertStatus(alertId, "investigating", response.data));
      toast({
        title: "Success",
        description: "Alert assigned successfully",
      });
      return response;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign alert",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Context value
  const value = {
    // State
    ...state,
    
    // Actions
    fetchAlerts,
    fetchAlert,
    acknowledgeAlert,
    updateAlertStatus,
    addNote,
    escalateAlert,
    closeAlert,
    refreshScreenshots,
    fetchStatistics,
    fetchUnreadCount,
    setFilters,
    clearFilters,
    assignAlert,
    
    // For real-time updates (to be implemented with WebSocket/SSE)
    onRealtimeAlert: (alert) => dispatch(actions.realtimeAlertReceived(alert)),
    onRealtimeAlertUpdate: (alert) => dispatch(actions.realtimeAlertUpdated(alert)),
  };

  return (
    <VideoAlertsContext.Provider value={value}>
      {children}
    </VideoAlertsContext.Provider>
  );
};
