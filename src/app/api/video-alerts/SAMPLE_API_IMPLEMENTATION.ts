/**
 * Sample API Route Implementation
 * This shows how to implement the backend endpoints for video alerts
 * 
 * Location: src/app/api/video-alerts/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/video-alerts
 * Fetch alerts with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.getAll("status");
    const severity = searchParams.getAll("severity");
    const alertType = searchParams.getAll("alert_type");
    const vehicleIds = searchParams.getAll("vehicle_ids");
    const driverIds = searchParams.getAll("driver_ids");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const escalatedOnly = searchParams.get("escalated_only") === "true";
    const requiresActionOnly = searchParams.get("requires_action_only") === "true";
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "50");

    // Build query
    let query = supabase
      .from("video_alerts")
      .select(`
        *,
        vehicle:vehicles(id, registration),
        driver:drivers(id, name),
        screenshots:alert_screenshots(*),
        notes:alert_notes(*),
        history:alert_history(*)
      `, { count: "exact" })
      .order("timestamp", { ascending: false });

    // Apply filters
    if (status.length > 0) {
      query = query.in("status", status);
    }
    if (severity.length > 0) {
      query = query.in("severity", severity);
    }
    if (alertType.length > 0) {
      query = query.in("alert_type", alertType);
    }
    if (vehicleIds.length > 0) {
      query = query.in("vehicle_id", vehicleIds);
    }
    if (driverIds.length > 0) {
      query = query.in("driver_id", driverIds);
    }
    if (dateFrom) {
      query = query.gte("timestamp", dateFrom);
    }
    if (dateTo) {
      query = query.lte("timestamp", dateTo);
    }
    if (escalatedOnly) {
      query = query.eq("escalated", true);
    }
    if (requiresActionOnly) {
      query = query.eq("requires_action", true);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data: alerts, error, count } = await query;

    if (error) {
      console.error("Error fetching alerts:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform data to match frontend interface
    const transformedAlerts = alerts?.map((alert) => ({
      ...alert,
      vehicle_registration: alert.vehicle?.registration,
      driver_name: alert.driver?.name,
    }));

    // Get statistics
    const { data: stats } = await supabase.rpc("get_alert_statistics");

    return NextResponse.json({
      success: true,
      data: transformedAlerts || [],
      total: count || 0,
      page,
      page_size: pageSize,
      statistics: stats,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Sample SQL function for statistics
 * Run this in your database to create the statistics function
 */

/*
CREATE OR REPLACE FUNCTION get_alert_statistics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_alerts', (SELECT COUNT(*) FROM video_alerts),
    'new_alerts', (SELECT COUNT(*) FROM video_alerts WHERE status = 'new'),
    'acknowledged_alerts', (SELECT COUNT(*) FROM video_alerts WHERE status = 'acknowledged'),
    'investigating_alerts', (SELECT COUNT(*) FROM video_alerts WHERE status = 'investigating'),
    'escalated_alerts', (SELECT COUNT(*) FROM video_alerts WHERE escalated = true),
    'resolved_today', (
      SELECT COUNT(*) FROM video_alerts 
      WHERE status = 'resolved' 
      AND DATE(resolved_at) = CURRENT_DATE
    ),
    'critical_alerts', (
      SELECT COUNT(*) FROM video_alerts 
      WHERE severity = 'critical' 
      AND status NOT IN ('resolved', 'closed')
    ),
    'average_response_time_minutes', (
      SELECT COALESCE(AVG(
        EXTRACT(EPOCH FROM (acknowledged_at - timestamp)) / 60
      )::INTEGER, 0)
      FROM video_alerts
      WHERE acknowledged_at IS NOT NULL
      AND DATE(timestamp) >= CURRENT_DATE - INTERVAL '7 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
*/

/**
 * Additional API route examples:
 * 
 * 1. GET /api/video-alerts/[id]/route.ts
 * 2. POST /api/video-alerts/[id]/acknowledge/route.ts
 * 3. POST /api/video-alerts/[id]/close/route.ts
 * 4. POST /api/video-alerts/[id]/escalate/route.ts
 * 5. POST /api/video-alerts/[id]/notes/route.ts
 * 6. POST /api/video-alerts/[id]/screenshots/refresh/route.ts
 * 
 * Follow similar patterns as above for each endpoint.
 */
