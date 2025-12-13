/**
 * Video Alert Management Types
 * Comprehensive type definitions for the video alert system
 */

export type AlertStatus = 
  | "new"           // Just triggered, not acknowledged
  | "acknowledged"  // Seen by operator
  | "investigating" // Under review
  | "escalated"     // Sent to management
  | "resolved"      // Issue resolved
  | "closed";       // Officially closed with notes

export type AlertSeverity = 
  | "critical"  // Immediate attention required
  | "high"      // Urgent, requires quick response
  | "medium"    // Important, standard response time
  | "low"       // Informational, no immediate action
  | "info";     // FYI only

export type AlertType = 
  | "harsh_braking"
  | "speeding"
  | "collision_detected"
  | "lane_departure"
  | "driver_distraction"
  | "drowsiness"
  | "unauthorized_stop"
  | "geofence_violation"
  | "vehicle_tamper"
  | "camera_offline"
  | "system_error"
  | "custom";

export type AlertAction = 
  | "acknowledged"
  | "assigned"
  | "note_added"
  | "status_changed"
  | "escalated"
  | "screenshot_captured"
  | "video_reviewed"
  | "resolved"
  | "closed";

// Main Alert Interface
export interface VideoAlert {
  id: string;
  
  // Core Information
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  
  // Vehicle & Driver Context
  vehicle_id: string;
  vehicle_registration?: string;
  driver_id?: string;
  driver_name?: string;
  
  // Location & Time
  timestamp: string; // ISO 8601 format
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  
  // Video & Evidence
  camera_ids: string[]; // Which cameras captured the event
  screenshots: AlertScreenshot[];
  video_clips?: AlertVideoClip[];
  
  // Workflow Management
  assigned_to?: string; // User ID
  assigned_to_name?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolved_by_name?: string;
  closed_at?: string;
  closed_by?: string;
  closed_by_name?: string;
  
  // Escalation
  escalated: boolean;
  escalated_at?: string;
  escalated_to?: string; // Management user ID
  escalated_to_name?: string;
  escalation_reason?: string;
  
  // Notes & History
  notes: AlertNote[];
  history: AlertHistoryEntry[];
  
  // Metadata
  requires_action: boolean;
  auto_resolved: boolean;
  false_positive?: boolean;
  tags?: string[];
  
  created_at: string;
  updated_at: string;
}

// Screenshot captured at time of alert
export interface AlertScreenshot {
  id: string;
  alert_id: string;
  camera_id: string;
  camera_name: string;
  url: string; // Storage URL
  thumbnail_url?: string;
  timestamp: string;
  capture_offset: number; // Seconds relative to alert (e.g., -5, 0, +5)
  width?: number;
  height?: number;
  file_size?: number;
  created_at: string;
}

// Video clip (30s before/after for priority alerts)
export interface AlertVideoClip {
  id: string;
  alert_id: string;
  camera_id: string;
  camera_name: string;
  url: string;
  thumbnail_url?: string;
  duration: number; // seconds
  start_time: string; // When recording started
  end_time: string; // When recording ended
  file_size?: number;
  format?: string; // mp4, webm, etc.
  created_at: string;
}

// Notes added by users
export interface AlertNote {
  id: string;
  alert_id: string;
  user_id: string;
  user_name: string;
  user_role?: string;
  content: string;
  is_internal: boolean; // Internal notes vs. client-facing
  created_at: string;
  updated_at?: string;
}

// Complete audit trail
export interface AlertHistoryEntry {
  id: string;
  alert_id: string;
  action: AlertAction;
  user_id?: string;
  user_name?: string;
  old_value?: string | null;
  new_value?: string | null;
  details?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Escalation Rule
export interface AlertEscalationRule {
  id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  time_threshold_minutes: number; // Escalate if not resolved within X minutes
  escalate_to_role: string; // "manager", "director", etc.
  escalate_to_users?: string[]; // Specific user IDs
  notification_channels: ("email" | "sms" | "push" | "bell")[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Statistics for dashboard
export interface AlertStatistics {
  total_alerts: number;
  new_alerts: number;
  acknowledged_alerts: number;
  investigating_alerts: number;
  escalated_alerts: number;
  resolved_today: number;
  critical_alerts: number;
  average_response_time_minutes: number;
  alerts_by_type: Record<AlertType, number>;
  alerts_by_severity: Record<AlertSeverity, number>;
  alerts_by_vehicle: Array<{
    vehicle_id: string;
    vehicle_registration: string;
    count: number;
  }>;
  alerts_by_driver: Array<{
    driver_id: string;
    driver_name: string;
    count: number;
  }>;
}

// Filter options for alert list
export interface AlertFilters {
  status?: AlertStatus[];
  severity?: AlertSeverity[];
  alert_type?: AlertType[];
  vehicle_ids?: string[];
  driver_ids?: string[];
  assigned_to?: string[];
  date_from?: string;
  date_to?: string;
  escalated_only?: boolean;
  requires_action_only?: boolean;
  search?: string;
}

// For real-time notifications
export interface AlertNotification {
  alert_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  vehicle_registration?: string;
  driver_name?: string;
  timestamp: string;
  thumbnail_url?: string;
  requires_immediate_attention: boolean;
}

// API Response types
export interface AlertsResponse {
  success: boolean;
  data: VideoAlert[];
  total: number;
  page: number;
  page_size: number;
  statistics?: AlertStatistics;
}

export interface AlertResponse {
  success: boolean;
  data: VideoAlert;
  message?: string;
}

export interface CloseAlertRequest {
  alert_id: string;
  closing_notes: string; // Required
  false_positive?: boolean;
  action_taken?: string;
}

export interface EscalateAlertRequest {
  alert_id: string;
  escalate_to: string; // User ID
  reason: string;
  priority?: "urgent" | "standard";
}

export interface AddNoteRequest {
  alert_id: string;
  content: string;
  is_internal: boolean;
}

// Context State
export interface VideoAlertsState {
  alerts: VideoAlert[];
  selectedAlert: VideoAlert | null;
  statistics: AlertStatistics | null;
  filters: AlertFilters;
  loading: boolean;
  error: string | null;
  unreadCount: number; // For bell notification
  realtimeEnabled: boolean;
}

// Action Types for Context
export enum VideoAlertActionTypes {
  FETCH_ALERTS = "FETCH_ALERTS",
  FETCH_ALERT = "FETCH_ALERT",
  SET_FILTERS = "SET_FILTERS",
  CLEAR_FILTERS = "CLEAR_FILTERS",
  ACKNOWLEDGE_ALERT = "ACKNOWLEDGE_ALERT",
  UPDATE_ALERT_STATUS = "UPDATE_ALERT_STATUS",
  ADD_NOTE = "ADD_NOTE",
  ESCALATE_ALERT = "ESCALATE_ALERT",
  CLOSE_ALERT = "CLOSE_ALERT",
  REFRESH_SCREENSHOTS = "REFRESH_SCREENSHOTS",
  SET_STATISTICS = "SET_STATISTICS",
  SET_UNREAD_COUNT = "SET_UNREAD_COUNT",
  REALTIME_ALERT_RECEIVED = "REALTIME_ALERT_RECEIVED",
  REALTIME_ALERT_UPDATED = "REALTIME_ALERT_UPDATED",
  SET_LOADING = "SET_LOADING",
  SET_ERROR = "SET_ERROR",
}
