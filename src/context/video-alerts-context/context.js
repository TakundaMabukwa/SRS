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
  const [currentUser] = React.useState({ id: "user-1", name: "Operator" });

  // Load initial data on mount
  useEffect(() => {
    fetchAlerts({});
    dispatch(actions.setLoading(false));
  }, []);

  const fetchAlerts = useCallback(async (filters = {}) => {
    dispatch(actions.setLoading(true));
    try {
      const response = await api.fetchAlertsAPI(filters);
      dispatch(actions.fetchAlerts(response));
      dispatch(actions.setLoading(false));
    } catch (error) {
      dispatch(actions.setError('Failed to load alerts'));
      dispatch(actions.setLoading(false));
    }
  }, [toast]);

  const fetchAlert = useCallback(async (alertOrId) => {
    const alertId = typeof alertOrId === "object" ? alertOrId?.id : alertOrId;
    if (!alertId) return null;

    const localAlert =
      typeof alertOrId === "object"
        ? alertOrId
        : state.alerts.find((a) => a.id === alertId);

    let remoteAlert = null;
    let remoteHistory = [];

    try {
      const [alertRes, historyRes] = await Promise.all([
        fetch(`/api/video-server/alerts/${alertId}`),
        fetch(`/api/video-server/alerts/${alertId}/history`),
      ]);

      if (alertRes.ok) {
        const alertData = await alertRes.json();
        if (alertData?.success) {
          remoteAlert = alertData.alert || alertData.data || null;
        }
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        if (historyData?.success) {
          remoteHistory = historyData.history || historyData.data || [];
        }
      }
    } catch (_) {
      // Keep local alert as fallback when remote fetch fails
    }

    const finalAlert = {
      ...(localAlert || {}),
      ...(remoteAlert || {}),
      id: alertId,
      screenshots: remoteAlert?.screenshots || localAlert?.screenshots || [],
      notes: remoteAlert?.notes || localAlert?.notes || [],
      history:
        remoteHistory.length > 0
          ? remoteHistory
          : remoteAlert?.history || localAlert?.history || [],
    };

    if (!finalAlert?.id) return null;

    dispatch(actions.fetchAlert(finalAlert));
    return finalAlert;
  }, [state.alerts]);

  const acknowledgeAlert = useCallback(async (alertId, userId) => {
    try {
      const response = await api.acknowledgeAlertAPI(alertId, userId);
      const remoteAlert = response?.alert || response?.data || {};
      const acknowledgedData = {
        acknowledged_at: remoteAlert?.acknowledged_at || new Date().toISOString(),
        acknowledged_by: remoteAlert?.acknowledged_by || userId,
        acknowledged_by_name: remoteAlert?.acknowledged_by_name || currentUser.name
      };
      dispatch(actions.acknowledgeAlert(alertId, acknowledgedData));
      await fetchAlert(alertId);
      toast({ title: "Success", description: "Alert acknowledged" });
      return acknowledgedData;
    } catch (error) {
      toast({ title: "Error", description: "Failed to acknowledge alert", variant: "destructive" });
      return null;
    }
  }, [toast, fetchAlert]);

  const updateAlertStatus = useCallback(async (alertId, newStatus, userId, details = {}) => {
    try {
      const response = await api.updateAlertStatusAPI(alertId, newStatus, userId, details);
      const remoteAlert = response?.alert || response?.data || {};
      const statusFromServer = String(remoteAlert?.status || newStatus || "").trim() || newStatus;
      const updatedData = {
        ...remoteAlert,
        status: statusFromServer,
        updated_at: remoteAlert?.updated_at || new Date().toISOString(),
        ...(statusFromServer === 'resolved' && {
          resolved_at: remoteAlert?.resolved_at || new Date().toISOString(),
          resolved_by: remoteAlert?.resolved_by || userId
        }),
        ...(statusFromServer === 'closed' && {
          closed_at: remoteAlert?.closed_at || new Date().toISOString(),
          closed_by: remoteAlert?.closed_by || userId
        }),
      };
      dispatch(actions.updateAlertStatus(alertId, statusFromServer, updatedData));
      await fetchAlert(alertId);
      toast({ title: "Success", description: `Alert status updated to ${statusFromServer}` });
      return updatedData;
    } catch (error) {
      toast({ title: "Error", description: `Failed to update alert status to ${newStatus}`, variant: "destructive" });
      return null;
    }
  }, [toast, fetchAlert]);

  const addNote = useCallback(async (alertId, noteData) => {
    const note = {
      id: `note-${Date.now()}`,
      alert_id: alertId,
      user_id: noteData.user_id,
      user_name: noteData.user_name,
      user_role: noteData.user_role,
      content: noteData.content,
      is_internal: noteData.is_internal,
      created_at: new Date().toISOString()
    };
    dispatch(actions.addNote(alertId, note));
    toast({ title: "Success", description: "Note added to alert" });
    return note;
  }, [toast]);

  const escalateAlert = useCallback(async (alertId, escalationData) => {
    try {
      const response = await api.escalateAlertAPI(alertId, escalationData);
      const remoteAlert = response?.alert || response?.data || {};
      const escalation = {
        escalated_at: remoteAlert?.escalated_at || new Date().toISOString(),
        escalated_to: remoteAlert?.escalated_to || escalationData.escalate_to,
        escalated_to_name: remoteAlert?.escalated_to_name || escalationData.escalate_to_name,
        reason: remoteAlert?.escalation_reason || escalationData.reason
      };
      dispatch(actions.escalateAlert(alertId, escalation));
      await fetchAlert(alertId);
      toast({ title: "Alert Escalated", description: "Alert escalated to management" });
      return escalation;
    } catch (error) {
      toast({ title: "Error", description: "Failed to escalate alert", variant: "destructive" });
      return null;
    }
  }, [toast, fetchAlert]);

  const closeAlert = useCallback(async (alertId, closingData) => {
    try {
      const response = await api.closeAlertAPI(alertId, closingData);
      const remoteAlert = response?.alert || response?.data || {};
      const closed = {
        closed_at: remoteAlert?.closed_at || remoteAlert?.resolved_at || new Date().toISOString(),
        closed_by: remoteAlert?.closed_by || remoteAlert?.resolved_by || closingData.userId,
        closed_by_name: remoteAlert?.closed_by_name || remoteAlert?.resolved_by_name || closingData.userName || 'User'
      };
      dispatch(actions.closeAlert(alertId, closed));
      await fetchAlert(alertId);
      toast({ title: "Alert Closed", description: "Alert has been successfully closed" });
      return closed;
    } catch (error) {
      toast({ title: "Error", description: "Failed to close alert", variant: "destructive" });
      return null;
    }
  }, [toast, fetchAlert]);

  const refreshScreenshots = useCallback(async (alertId) => {
    try {
      const res = await fetch(`/api/video-server/alerts/${alertId}`);
      if (!res.ok) return [];

      const data = await res.json();
      const alert = data.alert || data.data;
      const screenshots = alert?.screenshots || alert?.media?.screenshots || [];
      dispatch(actions.refreshScreenshots(alertId, screenshots));
      return screenshots;
    } catch (_) {
      return [];
    }
  }, []);

  const fetchStatistics = useCallback(async (dateFrom, dateTo) => {
    const stats = {
      critical_alerts: state.alerts.filter(a => a.severity === 'critical' && !['closed', 'resolved'].includes(a.status)).length,
      total_alerts: state.alerts.filter(a => !['closed', 'resolved'].includes(a.status)).length,
      resolved_today: state.alerts.filter(a => {
        if (!['closed', 'resolved'].includes(a.status)) return false;
        const today = new Date().toDateString();
        const resolvedDate = new Date(a.resolved_at || a.closed_at || a.updated_at).toDateString();
        return today === resolvedDate;
      }).length,
    };
    dispatch(actions.fetchStatistics(stats));
    return stats;
  }, [state.alerts]);

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
