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
      const dummyDrivers = [
        { id: 'd1', first_name: 'JOHANNES', surname: 'MPHAKA', cell_number: '(079) 387 0137' },
        { id: 'd2', first_name: 'ARTWELL', surname: '(EXP)', cell_number: '(073) 471 5775' },
        { id: 'd3', first_name: 'BANGANI', surname: 'MVELASE', cell_number: '(076) 145 6345' },
        { id: 'd4', first_name: 'BHEKI', surname: 'LAWU', cell_number: '(072) 514 1183' },
        { id: 'd5', first_name: 'BHEKI', surname: 'MDAKANE', cell_number: '(072) 225 2268' }
      ];
      
      const dummyVehicles = [
        { id: 'v1', registration_number: 'KZL693MP', fleet_number: 'LH22', make: 'Scania' },
        { id: 'v2', registration_number: 'LDG415MP', fleet_number: 'LH30', make: 'Scania' },
        { id: 'v3', registration_number: 'LDR057MP', fleet_number: 'LH40', make: 'Scania' },
        { id: 'v4', registration_number: 'LDG421MP', fleet_number: 'LH32', make: 'Scania' },
        { id: 'v5', registration_number: 'KVR574MP', fleet_number: 'LH26', make: 'Scania' },
        { id: 'v6', registration_number: 'LDG425MP', fleet_number: 'LH34', make: 'Scania' },
        { id: 'v7', registration_number: 'KSG039MP', fleet_number: 'LH16', make: 'Scania' },
        { id: 'v8', registration_number: 'KZL671MP', fleet_number: 'LH21', make: 'Scania' },
        { id: 'v9', registration_number: 'KSG040MP', fleet_number: 'LH17', make: 'Scania' }
      ];
      
      const alertTypes = ['smoking', 'speeding'];
      const severities = ['critical', 'high', 'medium', 'low'];
      const statuses = ['new', 'acknowledged', 'investigating', 'escalated'];
      
      const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const randomDate = (hoursAgo) => {
        const date = new Date();
        const minutesAgo = Math.floor(Math.random() * hoursAgo * 60);
        date.setMinutes(date.getMinutes() - minutesAgo);
        return date.toISOString();
      };
      
      const dummyAlerts = Array.from({ length: 25 }, (_, i) => {
        const driver = randomItem(dummyDrivers);
        const vehicle = randomItem(dummyVehicles);
        const alertType = randomItem(alertTypes);
        const severity = randomItem(severities);
        const status = randomItem(statuses);
        const timestamp = randomDate(48);
        
        return {
          id: `alert-${i + 1}`,
          alert_type: alertType,
          severity,
          status,
          priority: severity,
          title: `${alertType.replace(/_/g, ' ').toUpperCase()} - ${vehicle.registration_number}`,
          description: `Alert triggered for ${alertType.replace(/_/g, ' ')}`,
          vehicle_id: vehicle.id,
          vehicle_registration: vehicle.registration_number,
          driver_id: driver.id,
          driver_name: `${driver.first_name} ${driver.surname}`,
          timestamp,
          requires_action: severity === 'critical' || severity === 'high',
          escalated: status === 'escalated',
          screenshots: [],
          notes: [],
          history: [],
          created_at: timestamp,
          updated_at: timestamp
        };
      });
      
      dispatch(actions.fetchAlerts({ data: dummyAlerts, statistics: { total: dummyAlerts.length } }));
      dispatch(actions.setLoading(false));
    } catch (error) {
      dispatch(actions.setError('Failed to load alerts'));
      dispatch(actions.setLoading(false));
    }
  }, [toast]);

  const fetchAlert = useCallback(async (alertId) => {
    const alert = state.alerts.find(a => a.id === alertId);
    if (alert) {
      const enrichedAlert = {
        ...alert,
        screenshots: [],
        history: [
          {
            id: 'h1',
            alert_id: alertId,
            action: 'Alert Created',
            user_name: 'System',
            details: `${alert.alert_type} detected`,
            timestamp: alert.timestamp
          }
        ],
        location: {
          latitude: -26.2041,
          longitude: 28.0473,
          address: 'N1 Highway, Johannesburg, Gauteng'
        }
      };
      
      dispatch(actions.fetchAlert(enrichedAlert));
      return enrichedAlert;
    }
    return null;
  }, [state.alerts]);

  const acknowledgeAlert = useCallback(async (alertId, userId) => {
    const acknowledgedData = {
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
      acknowledged_by_name: currentUser.name
    };
    dispatch(actions.acknowledgeAlert(alertId, acknowledgedData));
    toast({ title: "Success", description: "Alert acknowledged" });
    return acknowledgedData;
  }, [toast]);

  const updateAlertStatus = useCallback(async (alertId, newStatus, userId, details = {}) => {
    const updatedData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === 'resolved' && { resolved_at: new Date().toISOString(), resolved_by: userId })
    };
    dispatch(actions.updateAlertStatus(alertId, newStatus, updatedData));
    toast({ title: "Success", description: `Alert status updated to ${newStatus}` });
    return updatedData;
  }, [toast]);

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
    const escalation = {
      escalated_at: new Date().toISOString(),
      escalated_to: escalationData.escalate_to,
      escalated_to_name: escalationData.escalate_to_name,
      reason: escalationData.reason
    };
    dispatch(actions.escalateAlert(alertId, escalation));
    toast({ title: "Alert Escalated", description: "Alert escalated to management" });
    return escalation;
  }, [toast]);

  const closeAlert = useCallback(async (alertId, closingData) => {
    const closed = {
      closed_at: new Date().toISOString(),
      closed_by: closingData.userId,
      closed_by_name: closingData.userName || 'User'
    };
    dispatch(actions.closeAlert(alertId, closed));
    toast({ title: "Alert Closed", description: "Alert has been successfully closed" });
    return closed;
  }, [toast]);

  const refreshScreenshots = useCallback(async (alertId) => {
    return [];
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
