/**
 * Video Alerts Context - Actions
 * Action creators for managing video alerts state
 */

import { VideoAlertActionTypes as types } from "@/types/video-alerts";

// Fetch all alerts with filters
export const fetchAlerts = (filters = {}) => ({
  type: types.FETCH_ALERTS,
  payload: filters,
});

// Fetch single alert by ID
export const fetchAlert = (alertId) => ({
  type: types.FETCH_ALERT,
  payload: alertId,
});

// Set filter options
export const setFilters = (filters) => ({
  type: types.SET_FILTERS,
  payload: filters,
});

// Clear all filters
export const clearFilters = () => ({
  type: types.CLEAR_FILTERS,
});

// Acknowledge an alert (user has seen it)
export const acknowledgeAlert = (alertId, userId) => ({
  type: types.ACKNOWLEDGE_ALERT,
  payload: { alertId, acknowledgedData: userId },
});

// Update alert status
export const updateAlertStatus = (alertId, newStatus, userId) => ({
  type: types.UPDATE_ALERT_STATUS,
  payload: { alertId, newStatus, updatedData: userId },
});

// Add note to alert
export const addNote = (alertId, noteData) => ({
  type: types.ADD_NOTE,
  payload: { alertId, note: noteData },
});

// Escalate alert to management
export const escalateAlert = (alertId, escalationData) => ({
  type: types.ESCALATE_ALERT,
  payload: { alertId, escalationData },
});

// Close alert (requires notes)
export const closeAlert = (alertId, closingData) => ({
  type: types.CLOSE_ALERT,
  payload: { alertId, closedData: closingData },
});

// Refresh screenshots (every 30 seconds for active alerts)
export const refreshScreenshots = (alertId, screenshots) => ({
  type: types.REFRESH_SCREENSHOTS,
  payload: { alertId, screenshots },
});

// Set statistics
export const fetchStatistics = (statistics) => ({
  type: types.SET_STATISTICS,
  payload: statistics,
});

// Set statistics
export const setStatistics = (statistics) => ({
  type: types.SET_STATISTICS,
  payload: statistics,
});

// Set unread count for bell notification
export const setUnreadCount = (count) => ({
  type: types.SET_UNREAD_COUNT,
  payload: count,
});

// Real-time: New alert received
export const realtimeAlertReceived = (alert) => ({
  type: types.REALTIME_ALERT_RECEIVED,
  payload: alert,
});

// Real-time: Alert updated
export const realtimeAlertUpdated = (alert) => ({
  type: types.REALTIME_ALERT_UPDATED,
  payload: alert,
});

// Set loading state
export const setLoading = (isLoading) => ({
  type: types.SET_LOADING,
  payload: isLoading,
});

// Set error
export const setError = (error) => ({
  type: types.SET_ERROR,
  payload: error,
});
