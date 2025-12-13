/**
 * Video Alerts Context - API
 * API calls for video alerts backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// Helper for API calls
const apiCall = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "API request failed");
  }

  return response.json();
};

// Fetch all alerts with optional filters
export const fetchAlertsAPI = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add filters to query string
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.forEach((v) => queryParams.append(key, v));
      } else {
        queryParams.append(key, value);
      }
    }
  });

  const queryString = queryParams.toString();
  const endpoint = `/video-alerts${queryString ? `?${queryString}` : ""}`;
  
  return apiCall(endpoint);
};

// Fetch single alert by ID
export const fetchAlertByIdAPI = async (alertId) => {
  return apiCall(`/video-alerts/${alertId}`);
};

// Acknowledge alert
export const acknowledgeAlertAPI = async (alertId, userId) => {
  return apiCall(`/video-alerts/${alertId}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
};

// Update alert status
export const updateAlertStatusAPI = async (alertId, newStatus, userId, details = {}) => {
  return apiCall(`/video-alerts/${alertId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: newStatus,
      user_id: userId,
      ...details,
    }),
  });
};

// Add note to alert
export const addNoteAPI = async (alertId, noteData) => {
  return apiCall(`/video-alerts/${alertId}/notes`, {
    method: "POST",
    body: JSON.stringify(noteData),
  });
};

// Escalate alert
export const escalateAlertAPI = async (alertId, escalationData) => {
  return apiCall(`/video-alerts/${alertId}/escalate`, {
    method: "POST",
    body: JSON.stringify(escalationData),
  });
};

// Close alert (requires notes)
export const closeAlertAPI = async (alertId, closingData) => {
  return apiCall(`/video-alerts/${alertId}/close`, {
    method: "POST",
    body: JSON.stringify(closingData),
  });
};

// Refresh screenshots for an alert
export const refreshScreenshotsAPI = async (alertId) => {
  return apiCall(`/video-alerts/${alertId}/screenshots/refresh`, {
    method: "POST",
  });
};

// Get alert statistics
export const getAlertStatisticsAPI = async (dateFrom, dateTo) => {
  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.append("date_from", dateFrom);
  if (dateTo) queryParams.append("date_to", dateTo);
  
  const queryString = queryParams.toString();
  const endpoint = `/video-alerts/statistics${queryString ? `?${queryString}` : ""}`;
  
  return apiCall(endpoint);
};

// Get unread alert count
export const getUnreadCountAPI = async (userId) => {
  return apiCall(`/video-alerts/unread-count?user_id=${userId}`);
};

// Assign alert to user
export const assignAlertAPI = async (alertId, userId, assignedToId) => {
  return apiCall(`/video-alerts/${alertId}/assign`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      assigned_to: assignedToId,
    }),
  });
};

// Mark alert as false positive
export const markAsFalsePositiveAPI = async (alertId, userId, reason) => {
  return apiCall(`/video-alerts/${alertId}/false-positive`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      reason,
    }),
  });
};

// Get alert history
export const getAlertHistoryAPI = async (alertId) => {
  return apiCall(`/video-alerts/${alertId}/history`);
};

// Bulk acknowledge alerts
export const bulkAcknowledgeAlertsAPI = async (alertIds, userId) => {
  return apiCall(`/video-alerts/bulk-acknowledge`, {
    method: "POST",
    body: JSON.stringify({
      alert_ids: alertIds,
      user_id: userId,
    }),
  });
};

// Download video clip
export const downloadVideoClipAPI = async (clipId) => {
  return apiCall(`/video-alerts/clips/${clipId}/download`);
};

// Export alerts to CSV
export const exportAlertsAPI = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.forEach((v) => queryParams.append(key, v));
      } else {
        queryParams.append(key, value);
      }
    }
  });

  const queryString = queryParams.toString();
  const endpoint = `/video-alerts/export${queryString ? `?${queryString}` : ""}`;
  
  // For file downloads, return the URL instead of calling it
  return `${API_BASE_URL}${endpoint}`;
};
