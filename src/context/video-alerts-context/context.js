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

  // Load mock data on mount
  useEffect(() => {
    const mockAlerts = [
      {
        id: "alert-1",
        alert_type: "harsh_braking",
        severity: "critical",
        status: "new",
        title: "Harsh Braking Detected",
        description: "Vehicle braked suddenly at high speed",
        vehicle_id: "vehicle-1",
        vehicle_registration: "ABC-123",
        driver_id: "driver-1",
        driver_name: "John Smith",
        timestamp: new Date().toISOString(),
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          address: "New York, NY",
        },
        camera_ids: ["cam1", "cam2"],
        screenshots: [
          {
            id: "ss-1",
            alert_id: "alert-1",
            camera_id: "cam1",
            camera_name: "Front Camera",
            url: "https://via.placeholder.com/640x360/FF5733/FFFFFF?text=Front+Camera",
            timestamp: new Date().toISOString(),
            capture_offset: -5,
            created_at: new Date().toISOString(),
          },
          {
            id: "ss-2",
            alert_id: "alert-1",
            camera_id: "cam2",
            camera_name: "Rear Camera",
            url: "https://via.placeholder.com/640x360/3498DB/FFFFFF?text=Rear+Camera",
            timestamp: new Date().toISOString(),
            capture_offset: 0,
            created_at: new Date().toISOString(),
          },
        ],
        notes: [
          {
            id: "note-1",
            alert_id: "alert-1",
            user_id: "user-1",
            user_name: "Admin User",
            content: "Reviewing footage for traffic conditions",
            is_internal: false,
            created_at: new Date().toISOString(),
          },
        ],
        history: [
          {
            id: "hist-1",
            alert_id: "alert-1",
            action: "created",
            user_id: "system",
            user_name: "System",
            details: "Alert automatically generated",
            timestamp: new Date().toISOString(),
          },
        ],
        escalated: false,
        requires_action: true,
        auto_resolved: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "alert-2",
        alert_type: "speeding",
        severity: "high",
        status: "acknowledged",
        title: "Speed Limit Exceeded",
        description: "Vehicle traveling at 85 mph in 65 mph zone",
        vehicle_id: "vehicle-2",
        vehicle_registration: "XYZ-789",
        driver_id: "driver-2",
        driver_name: "Jane Doe",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        location: {
          latitude: 34.0522,
          longitude: -118.2437,
          address: "Los Angeles, CA",
        },
        camera_ids: ["cam1"],
        screenshots: [
          {
            id: "ss-3",
            alert_id: "alert-2",
            camera_id: "cam1",
            camera_name: "Dashboard Camera",
            url: "https://via.placeholder.com/640x360/E74C3C/FFFFFF?text=Speeding+Alert",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            capture_offset: 0,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        notes: [],
        history: [
          {
            id: "hist-2",
            alert_id: "alert-2",
            action: "acknowledged",
            user_id: "user-1",
            user_name: "Admin User",
            details: "Alert acknowledged by operator",
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
        escalated: false,
        requires_action: true,
        auto_resolved: false,
        acknowledged_at: new Date(Date.now() - 1800000).toISOString(),
        acknowledged_by: "user-1",
        acknowledged_by_name: "Admin User",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "alert-3",
        alert_type: "driver_distraction",
        severity: "medium",
        status: "investigating",
        title: "Driver Distraction Detected",
        description: "Driver looking away from road for extended period",
        vehicle_id: "vehicle-3",
        vehicle_registration: "LMN-456",
        driver_id: "driver-3",
        driver_name: "Bob Wilson",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        location: {
          latitude: 41.8781,
          longitude: -87.6298,
          address: "Chicago, IL",
        },
        camera_ids: ["cam4"],
        screenshots: [
          {
            id: "ss-4",
            alert_id: "alert-3",
            camera_id: "cam4",
            camera_name: "Interior Camera",
            url: "https://via.placeholder.com/640x360/F39C12/FFFFFF?text=Interior+View",
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            capture_offset: 0,
            created_at: new Date(Date.now() - 7200000).toISOString(),
          },
        ],
        notes: [
          {
            id: "note-2",
            alert_id: "alert-3",
            user_id: "user-1",
            user_name: "Admin User",
            content: "Driver was adjusting GPS. No safety concern.",
            is_internal: false,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        history: [
          {
            id: "hist-3",
            alert_id: "alert-3",
            action: "status_changed",
            user_id: "user-1",
            user_name: "Admin User",
            old_value: "acknowledged",
            new_value: "investigating",
            details: "Started investigation",
            timestamp: new Date(Date.now() - 5400000).toISOString(),
          },
        ],
        escalated: false,
        requires_action: true,
        auto_resolved: false,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 5400000).toISOString(),
      },
    ];

    const mockStatistics = {
      total_alerts: 45,
      new_alerts: 8,
      acknowledged_alerts: 12,
      investigating_alerts: 5,
      escalated_alerts: 2,
      resolved_today: 18,
      critical_alerts: 3,
      average_response_time_minutes: 12,
      alerts_by_type: {},
      alerts_by_severity: {},
      alerts_by_vehicle: [],
      alerts_by_driver: [],
    };

    // Store mock data in a ref so other functions can access it
    window.__mockAlerts = mockAlerts;
    window.__mockStatistics = mockStatistics;

    dispatch(actions.fetchAlerts({ data: mockAlerts, statistics: mockStatistics }));
    dispatch(actions.setUnreadCount(mockAlerts.filter((a) => a.status === "new").length));
  }, []);

  // Fetch alerts with filters - USE MOCK DATA
  const fetchAlerts = useCallback(async (filters = {}) => {
    dispatch(actions.setLoading(true));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockData = {
      data: window.__mockAlerts || [],
      statistics: window.__mockStatistics || null,
    };
    
    dispatch(actions.fetchAlerts(mockData));
    dispatch(actions.setLoading(false));
    return mockData;
  }, [toast]);

  // Fetch single alert - USE MOCK DATA
  const fetchAlert = useCallback(async (alertId) => {
    dispatch(actions.setLoading(true));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockAlerts = window.__mockAlerts || [];
    const alert = mockAlerts.find(a => a.id === alertId);
    
    if (alert) {
      dispatch(actions.fetchAlert(alert));
      dispatch(actions.setLoading(false));
      return alert;
    } else {
      dispatch(actions.setError("Alert not found"));
      dispatch(actions.setLoading(false));
      toast({
        title: "Error",
        description: "Alert not found",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Acknowledge alert - USE MOCK DATA
  const acknowledgeAlert = useCallback(async (alertId, userId) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockData = { acknowledged_at: new Date().toISOString(), acknowledged_by: userId };
    dispatch(actions.acknowledgeAlert(alertId, mockData));
    
    // Update mock data
    const mockAlerts = window.__mockAlerts || [];
    const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
    if (alertIndex !== -1) {
      mockAlerts[alertIndex].status = 'acknowledged';
      mockAlerts[alertIndex].acknowledged_at = mockData.acknowledged_at;
      mockAlerts[alertIndex].acknowledged_by = userId;
      window.__mockAlerts = mockAlerts;
    }
    
    toast({
      title: "Success",
      description: "Alert acknowledged",
    });
    return mockData;
  }, [toast]);

  // Update alert status - USE MOCK DATA
  const updateAlertStatus = useCallback(async (alertId, newStatus, userId, details = {}) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockData = { status: newStatus, updated_at: new Date().toISOString() };
    dispatch(actions.updateAlertStatus(alertId, newStatus, mockData));
    
    // Update mock data
    const mockAlerts = window.__mockAlerts || [];
    const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
    if (alertIndex !== -1) {
      mockAlerts[alertIndex].status = newStatus;
      mockAlerts[alertIndex].updated_at = mockData.updated_at;
      window.__mockAlerts = mockAlerts;
    }
    
    toast({
      title: "Success",
      description: `Alert status updated to ${newStatus}`,
    });
    return mockData;
  }, [toast]);

  // Add note to alert - USE MOCK DATA
  const addNote = useCallback(async (alertId, noteData) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newNote = {
      id: `note-${Date.now()}`,
      alert_id: alertId,
      user_id: noteData.userId || "user-1",
      user_name: noteData.userName || "Current User",
      content: noteData.content,
      is_internal: noteData.is_internal || false,
      created_at: new Date().toISOString(),
    };
    
    dispatch(actions.addNote(alertId, newNote));
    
    // Update mock data
    const mockAlerts = window.__mockAlerts || [];
    const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
    if (alertIndex !== -1) {
      if (!mockAlerts[alertIndex].notes) mockAlerts[alertIndex].notes = [];
      mockAlerts[alertIndex].notes.push(newNote);
      window.__mockAlerts = mockAlerts;
    }
    
    toast({
      title: "Success",
      description: "Note added to alert",
    });
    return newNote;
  }, [toast]);

  // Escalate alert - USE MOCK DATA
  const escalateAlert = useCallback(async (alertId, escalationData) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockData = {
      escalated: true,
      escalated_at: new Date().toISOString(),
      escalated_to: escalationData.escalate_to,
      escalation_reason: escalationData.reason
    };
    
    dispatch(actions.escalateAlert(alertId, mockData));
    
    // Update mock data
    const mockAlerts = window.__mockAlerts || [];
    const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
    if (alertIndex !== -1) {
      Object.assign(mockAlerts[alertIndex], mockData);
      window.__mockAlerts = mockAlerts;
    }
    
    toast({
      title: "Alert Escalated",
      description: `Alert escalated to ${escalationData.escalate_to_name || "management"}`,
      variant: "default",
    });
    return mockData;
  }, [toast]);

  // Close alert (requires notes) - USE MOCK DATA
  const closeAlert = useCallback(async (alertId, closingData) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockData = {
      status: 'resolved',
      closed_at: new Date().toISOString(),
      resolution_notes: closingData.notes,
      is_false_positive: closingData.is_false_positive || false,
      action_taken: closingData.action_taken
    };
    
    dispatch(actions.closeAlert(alertId, mockData));
    
    // Update mock data
    const mockAlerts = window.__mockAlerts || [];
    const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
    if (alertIndex !== -1) {
      Object.assign(mockAlerts[alertIndex], mockData);
      window.__mockAlerts = mockAlerts;
    }
    
    toast({
      title: "Alert Closed",
      description: "Alert has been successfully closed",
    });
    return mockData;
  }, [toast]);

  // Refresh screenshots - USE MOCK DATA
  const refreshScreenshots = useCallback(async (alertId) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockAlerts = window.__mockAlerts || [];
    const alert = mockAlerts.find(a => a.id === alertId);
    
    if (alert && alert.screenshots) {
      // Update timestamps to simulate refresh
      const refreshedScreenshots = alert.screenshots.map(ss => ({
        ...ss,
        timestamp: new Date().toISOString(),
      }));
      
      dispatch(actions.refreshScreenshots(alertId, refreshedScreenshots));
      
      // Update mock data
      const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
      if (alertIndex !== -1) {
        mockAlerts[alertIndex].screenshots = refreshedScreenshots;
        window.__mockAlerts = mockAlerts;
      }
      
      return refreshedScreenshots;
    }
    return null;
  }, []);

  // Fetch statistics - USE MOCK DATA
  const fetchStatistics = useCallback(async (dateFrom, dateTo) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockStats = window.__mockStatistics || {};
    dispatch(actions.setStatistics(mockStats));
    return mockStats;
  }, []);

  // Fetch unread count - USE MOCK DATA
  const fetchUnreadCount = useCallback(async (userId) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockAlerts = window.__mockAlerts || [];
    const unreadCount = mockAlerts.filter(a => a.status === 'new').length;
    dispatch(actions.setUnreadCount(unreadCount));
    return unreadCount;
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
