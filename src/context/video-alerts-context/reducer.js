/**
 * Video Alerts Context - Reducer
 * State management for video alerts
 */

import { VideoAlertActionTypes as types } from "@/types/video-alerts";

export const initialState = {
  alerts: [],
  selectedAlert: null,
  statistics: null,
  filters: {
    status: [],
    severity: [],
    alert_type: [],
    vehicle_ids: [],
    driver_ids: [],
    assigned_to: [],
    escalated_only: false,
    requires_action_only: false,
  },
  loading: false,
  error: null,
  unreadCount: 0,
  realtimeEnabled: true,
};

export const videoAlertsReducer = (state = initialState, action) => {
  switch (action.type) {
    case types.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case types.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case types.FETCH_ALERTS:
      return {
        ...state,
        alerts: action.payload.data || [],
        statistics: action.payload.statistics || state.statistics,
        loading: false,
        error: null,
      };

    case types.FETCH_ALERT:
      return {
        ...state,
        selectedAlert: action.payload,
        loading: false,
        error: null,
      };

    case types.SET_FILTERS:
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload,
        },
      };

    case types.CLEAR_FILTERS:
      return {
        ...state,
        filters: initialState.filters,
      };

    case types.ACKNOWLEDGE_ALERT: {
      const { alertId, acknowledgedData } = action.payload;
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: "acknowledged",
                acknowledged_at: acknowledgedData.acknowledged_at,
                acknowledged_by: acknowledgedData.acknowledged_by,
                acknowledged_by_name: acknowledgedData.acknowledged_by_name,
              }
            : alert
        ),
        selectedAlert:
          state.selectedAlert?.id === alertId
            ? {
                ...state.selectedAlert,
                status: "acknowledged",
                acknowledged_at: acknowledgedData.acknowledged_at,
                acknowledged_by: acknowledgedData.acknowledged_by,
                acknowledged_by_name: acknowledgedData.acknowledged_by_name,
              }
            : state.selectedAlert,
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }

    case types.UPDATE_ALERT_STATUS: {
      const { alertId, newStatus, updatedData } = action.payload;
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: newStatus,
                ...updatedData,
                updated_at: new Date().toISOString(),
              }
            : alert
        ),
        selectedAlert:
          state.selectedAlert?.id === alertId
            ? {
                ...state.selectedAlert,
                status: newStatus,
                ...updatedData,
                updated_at: new Date().toISOString(),
              }
            : state.selectedAlert,
      };
    }

    case types.ADD_NOTE: {
      const { alertId, note } = action.payload;
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                notes: [...(alert.notes || []), note],
                updated_at: new Date().toISOString(),
              }
            : alert
        ),
        selectedAlert:
          state.selectedAlert?.id === alertId
            ? {
                ...state.selectedAlert,
                notes: [...(state.selectedAlert.notes || []), note],
                updated_at: new Date().toISOString(),
              }
            : state.selectedAlert,
      };
    }

    case types.ESCALATE_ALERT: {
      const { alertId, escalationData } = action.payload;
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: "escalated",
                escalated: true,
                escalated_at: escalationData?.escalated_at || new Date().toISOString(),
                escalated_to: escalationData?.escalated_to,
                escalated_to_name: escalationData?.escalated_to_name,
                escalation_reason: escalationData?.escalation_reason || escalationData?.reason,
                updated_at: new Date().toISOString(),
              }
            : alert
        ),
        selectedAlert:
          state.selectedAlert?.id === alertId
            ? {
                ...state.selectedAlert,
                status: "escalated",
                escalated: true,
                escalated_at: escalationData.escalated_at,
                escalated_to: escalationData.escalated_to,
                escalated_to_name: escalationData.escalated_to_name,
                escalation_reason: escalationData.reason,
                updated_at: new Date().toISOString(),
              }
            : state.selectedAlert,
      };
    }

    case types.CLOSE_ALERT: {
      const { alertId, closedData } = action.payload;
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: "closed",
                closed_at: closedData.closed_at,
                closed_by: closedData.closed_by,
                closed_by_name: closedData.closed_by_name,
                updated_at: new Date().toISOString(),
              }
            : alert
        ),
        selectedAlert:
          state.selectedAlert?.id === alertId
            ? {
                ...state.selectedAlert,
                status: "closed",
                closed_at: closedData.closed_at,
                closed_by: closedData.closed_by,
                closed_by_name: closedData.closed_by_name,
                updated_at: new Date().toISOString(),
              }
            : state.selectedAlert,
      };
    }

    case types.REFRESH_SCREENSHOTS: {
      const { alertId, screenshots } = action.payload;
      return {
        ...state,
        selectedAlert:
          state.selectedAlert?.id === alertId
            ? {
                ...state.selectedAlert,
                screenshots: screenshots,
                updated_at: new Date().toISOString(),
              }
            : state.selectedAlert,
      };
    }

    case types.SET_STATISTICS:
      return {
        ...state,
        statistics: action.payload,
      };

    case types.SET_UNREAD_COUNT:
      return {
        ...state,
        unreadCount: action.payload,
      };

    case types.REALTIME_ALERT_RECEIVED: {
      const newAlert = action.payload;
      return {
        ...state,
        alerts: [newAlert, ...state.alerts],
        unreadCount: state.unreadCount + 1,
        statistics: state.statistics
          ? {
              ...state.statistics,
              total_alerts: state.statistics.total_alerts + 1,
              new_alerts: state.statistics.new_alerts + 1,
            }
          : null,
      };
    }

    case types.REALTIME_ALERT_UPDATED: {
      const updatedAlert = action.payload;
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === updatedAlert.id ? updatedAlert : alert
        ),
        selectedAlert:
          state.selectedAlert?.id === updatedAlert.id
            ? updatedAlert
            : state.selectedAlert,
      };
    }

    default:
      return state;
  }
};
