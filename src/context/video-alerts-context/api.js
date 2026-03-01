/**
 * Video Alerts Context - API
 * API calls for video alerts backend
 */

const API_BASE_URL = "/api/video-server";

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
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });
  const queryString = queryParams.toString();
  const response = await apiCall(`/alerts${queryString ? `?${queryString}` : ""}`);
  return {
    data: response.alerts || [],
    statistics: response.statistics || null
  };
};

// Fetch single alert by ID with media
export const fetchAlertByIdAPI = async (alertId) => {
  return apiCall(`/alerts/${alertId}`);
};

// Acknowledge alert
export const acknowledgeAlertAPI = async (alertId, userId) => {
  return apiCall(`/alerts/${alertId}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
};

// Update alert status
export const updateAlertStatusAPI = async (alertId, newStatus, userId, details = {}) => {
  if (newStatus === "resolved" || newStatus === "closed") {
    return apiCall(`/alerts/${alertId}/resolve-with-notes`, {
      method: "POST",
      body: JSON.stringify({
        notes: details?.notes || "Resolved from dashboard",
        resolvedBy: userId,
        ...details,
      }),
    });
  }
  if (newStatus === "escalated") {
    return apiCall(`/alerts/${alertId}/escalate`, {
      method: "POST",
      body: JSON.stringify({
        reason: details?.reason || "Escalated from dashboard",
        escalatedBy: userId,
        ...details,
      }),
    });
  }
  if (newStatus === "acknowledged") {
    return acknowledgeAlertAPI(alertId, userId);
  }
  return { success: true, status: newStatus };
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
  return apiCall(`/alerts/${alertId}/escalate`, {
    method: "POST",
    body: JSON.stringify(escalationData),
  });
};

// Close alert (requires notes)
export const closeAlertAPI = async (alertId, closingData) => {
  return apiCall(`/alerts/${alertId}/resolve-with-notes`, {
    method: "POST",
    body: JSON.stringify(closingData),
  });
};

// Refresh screenshots for an alert
export const refreshScreenshotsAPI = async (alertId) => {
  return apiCall(`/alerts/${alertId}/screenshots`);
};

// Get alert statistics
export const getAlertStatisticsAPI = async (dateFrom, dateTo) => {
  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.append("date_from", dateFrom);
  if (dateTo) queryParams.append("date_to", dateTo);
  
  const queryString = queryParams.toString();
  const endpoint = `/alerts/stats${queryString ? `?${queryString}` : ""}`;
  
  return apiCall(endpoint);
};

// Get unread alert count
export const getUnreadCountAPI = async (userId) => {
  return { success: true, count: 0 };
};

// Assign alert to user
export const assignAlertAPI = async (alertId, userId, assignedToId) => {
  return { success: true, data: { id: alertId, assigned_to: assignedToId, user_id: userId } };
};

// Mark alert as false positive
export const markAsFalsePositiveAPI = async (alertId, userId, reason) => {
  return apiCall(`/alerts/${alertId}/mark-false`, {
    method: "POST",
    body: JSON.stringify({
      markedBy: userId,
      reason,
    }),
  });
};

// Get alert history
export const getAlertHistoryAPI = async (alertId) => {
  return apiCall(`/alerts/${alertId}/history`);
};

// Bulk acknowledge alerts
export const bulkAcknowledgeAlertsAPI = async (alertIds, userId) => {
  const results = await Promise.all(
    (alertIds || []).map((id) => acknowledgeAlertAPI(id, userId).catch((error) => ({ success: false, error })))
  );
  return { success: true, results };
};

// Download video clip
export const downloadVideoClipAPI = async (clipId) => {
  return { success: true, url: `${API_BASE_URL}/alerts/${clipId}/video?type=camera&download=true` };
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
  const endpoint = `/alerts/export${queryString ? `?${queryString}` : ""}`;
  
  // For file downloads, return the URL instead of calling it
  return `${API_BASE_URL}${endpoint}`;
};
