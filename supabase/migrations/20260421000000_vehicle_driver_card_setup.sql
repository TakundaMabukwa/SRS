-- Vehicle driver-card setup
-- Purpose:
-- 1. Store a base vehicle profile row so every vehicle starts at 100
-- 2. Store NCRs linked to a vehicle/device and optionally to an alert
-- 3. Expose a simple month-to-date standings view derived from alerts
-- Scoring rule:
--   current_points = max(0, 100 - floor(total_alerts / 10))

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_ncrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id text NOT NULL,
  device_id text,
  registration_number text,
  fleet_number text,
  alert_id text,
  ncr_number text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled')),
  severity text,
  document_url text,
  document_name text,
  created_by text,
  closed_by text,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_ncrs_vehicle_id
  ON vehicle_ncrs(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_ncrs_device_id
  ON vehicle_ncrs(device_id)
  WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_ncrs_alert_id
  ON vehicle_ncrs(alert_id)
  WHERE alert_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_ncrs_status
  ON vehicle_ncrs(status);

CREATE TABLE IF NOT EXISTS vehicle_driver_card_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id text NOT NULL UNIQUE,
  device_id text,
  registration_number text,
  fleet_number text,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_driver_card_profiles_vehicle_id
  ON vehicle_driver_card_profiles(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_driver_card_profiles_device_id
  ON vehicle_driver_card_profiles(device_id)
  WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_driver_card_profiles_registration
  ON vehicle_driver_card_profiles(registration_number)
  WHERE registration_number IS NOT NULL;

INSERT INTO vehicle_driver_card_profiles (
  vehicle_id,
  registration_number,
  display_name
)
VALUES
  ('KXZ493MP','KXZ493MP','KXZ493MP'),
  ('KXZ487MP','KXZ487MP','KXZ487MP'),
  ('JFP879FS','JFP879FS','JFP879FS'),
  ('LDG433MP','LDG433MP','LDG433MP'),
  ('JFP864FS','JFP864FS','JFP864FS'),
  ('KVW508MP','KVW508MP','KVW508MP'),
  ('LCZ936MP','LCZ936MP','LCZ936MP'),
  ('LCZ761MP','LCZ761MP','LCZ761MP'),
  ('JHD689FS','JHD689FS','JHD689FS'),
  ('JGR332FS','JGR332FS','JGR332FS'),
  ('KZL693MP','KZL693MP','KZL693MP'),
  ('LDG415MP','LDG415MP','LDG415MP'),
  ('LDR057MP','LDR057MP','LDR057MP'),
  ('LDG421MP','LDG421MP','LDG421MP'),
  ('KVR574MP','KVR574MP','KVR574MP'),
  ('LDG425MP','LDG425MP','LDG425MP'),
  ('KSG039MP','KSG039MP','KSG039MP'),
  ('KZL671MP','KZL671MP','KZL671MP'),
  ('KSG040MP','KSG040MP','KSG040MP'),
  ('KVR579MP','KVR579MP','KVR579MP'),
  ('JFP881FS','JFP881FS','JFP881FS'),
  ('LDG067MP','LDG067MP','LDG067MP'),
  ('JFP868FS','JFP868FS','JFP868FS'),
  ('JGK731FS','JGK731FS','JGK731FS'),
  ('LDG360MP','LDG360MP','LDG360MP'),
  ('LDG451MP','LDG451MP','LDG451MP'),
  ('JFW161FS','JFW161FS','JFW161FS'),
  ('JGV562FS','JGV562FS','JGV562FS'),
  ('JGV566FS','JGV566FS','JGV566FS'),
  ('JGW959FS','JGW959FS','JGW959FS'),
  ('JJT993FS','JJT993FS','JJT993FS'),
  ('KXN238MP','KXN238MP','KXN238MP'),
  ('JGV563FS','JGV563FS','JGV563FS'),
  ('JGV564FS','JGV564FS','JGV564FS'),
  ('LDG085MP','LDG085MP','LDG085MP'),
  ('LDG076MP','LDG076MP','LDG076MP'),
  ('KVW504FS','KVW504FS','KVW504FS'),
  ('JGV758FS','JGV758FS','JGV758FS'),
  ('JGR328FS','JGR328FS','JGR328FS'),
  ('JGW953FS','JGW953FS','JGW953FS'),
  ('LDG083MP','LDG083MP','LDG083MP'),
  ('KZY937MP','KZY937MP','KZY937MP'),
  ('KXZ484MP','KXZ484MP','KXZ484MP'),
  ('KZL673MP','KZL673MP','KZL673MP'),
  ('KVW506MP','KVW506MP','KVW506MP'),
  ('LDR065MP','LDR065MP','LDR065MP'),
  ('JGW963FS','JGW963FS','JGW963FS'),
  ('LDR067MP','LDR067MP','LDR067MP'),
  ('LDG440MP','LDG440MP','LDG440MP'),
  ('LDG443MP','LDG443MP','LDG443MP'),
  ('LDG422MP','LDG422MP','LDG422MP'),
  ('KSG035MP','KSG035MP','KSG035MP'),
  ('KVR577MP','KVR577MP','KVR577MP'),
  ('KSJ576MP','KSJ576MP','KSJ576MP'),
  ('KSJ572MP','KSJ572MP','KSJ572MP'),
  ('LDG428MP','LDG428MP','LDG428MP'),
  ('LDG419MP','LDG419MP','LDG419MP'),
  ('LDG436MP','LDG436MP','LDG436MP'),
  ('LDG368MP','LDG368MP','LDG368MP'),
  ('LDT526MP','LDT526MP','LDT526MP'),
  ('JGV567FS','JGV567FS','JGV567FS'),
  ('JGV565FS','JGV565FS','JGV565FS'),
  ('JFW159FS','JFW159FS','JFW159FS'),
  ('LCZ953MP','LCZ953MP','LCZ953MP'),
  ('KXN249MP','KXN249MP','KXN249MP'),
  ('JHD701FS','JHD701FS','JHD701FS'),
  ('KXG329MP','KXG329MP','KXG329MP'),
  ('JFW153FS','JFW153FS','JFW153FS'),
  ('JFP880FS','JFP880FS','JFP880FS'),
  ('JGR342FS','JGR342FS','JGR342FS'),
  ('JGW962FS','JGW962FS','JGW962FS'),
  ('LCZ922MP','LCZ922MP','LCZ922MP'),
  ('JGW961FS','JGW961FS','JGW961FS'),
  ('JFW162FS','JFW162FS','JFW162FS'),
  ('KXZ498MP','KXZ498MP','KXZ498MP'),
  ('JFW163FS','JFW163FS','JFW163FS'),
  ('JFP875FS','JFP875FS','JFP875FS'),
  ('LCM197MP','LCM197MP','LCM197MP'),
  ('KXN254MP','KXN254MP','KXN254MP')
ON CONFLICT (vehicle_id) DO UPDATE
SET
  registration_number = EXCLUDED.registration_number,
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- Helpful for the standings view if alert volume grows.
CREATE INDEX IF NOT EXISTS idx_alerts_device_timestamp
  ON alerts(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_device_type_timestamp
  ON alerts(device_id, alert_type, timestamp DESC);

DROP VIEW IF EXISTS vehicle_driver_card_standings_mtd;

CREATE VIEW vehicle_driver_card_standings_mtd AS
WITH month_alerts AS (
  SELECT
    a.id AS alert_id,
    COALESCE(
      NULLIF(BTRIM(a.metadata->>'registration_number'), ''),
      NULLIF(BTRIM(a.metadata->>'vehicle_registration'), ''),
      NULLIF(BTRIM(a.metadata->>'plate'), ''),
      a.device_id
    ) AS vehicle_key,
    a.device_id,
    a.timestamp,
    LOWER(COALESCE(a.alert_type, '')) AS alert_key,
    COALESCE(
      NULLIF(a.metadata->>'registration_number', ''),
      NULLIF(a.metadata->>'vehicle_registration', ''),
      NULLIF(a.metadata->>'plate', ''),
      NULLIF(a.metadata->>'registration', '')
    ) AS registration_number,
    COALESCE(
      NULLIF(a.metadata->>'fleet_number', ''),
      NULLIF(a.metadata->>'fleetNumber', ''),
      NULLIF(a.metadata->>'fleet', '')
    ) AS fleet_number,
    COALESCE(
      NULLIF(a.metadata->>'driver_name', ''),
      NULLIF(a.metadata->>'driverName', ''),
      NULLIF(a.metadata->>'target_name', ''),
      NULLIF(a.metadata->>'vehicle_registration', ''),
      NULLIF(a.metadata->>'registration_number', ''),
      NULLIF(a.metadata->>'fleet_number', ''),
      a.device_id
    ) AS display_name
  FROM alerts a
  WHERE a.device_id IS NOT NULL
    AND a.timestamp >= date_trunc('month', now())
    AND a.timestamp < now()
),
alert_agg AS (
  SELECT
    ma.vehicle_key,
    MAX(ma.device_id) AS device_id,
    MAX(ma.display_name) AS display_name,
    MAX(ma.registration_number) AS registration_number,
    MAX(ma.fleet_number) AS fleet_number,
    COUNT(*)::int AS total_alerts,
    COUNT(*) FILTER (WHERE ma.alert_key LIKE '%fatigue%')::int AS fatigue_alerts,
    COUNT(*) FILTER (
      WHERE ma.alert_key LIKE '%seat belt%'
         OR ma.alert_key LIKE '%seatbelt%'
         OR ma.alert_key LIKE '%dms alert type 8%'
    )::int AS seatbelt_alerts,
    COUNT(*) FILTER (
      WHERE ma.alert_key LIKE '%lane departure%'
         OR ma.alert_key LIKE '%lane deviation%'
         OR ma.alert_key LIKE '%adas alert type 2%'
    )::int AS lane_deviation_alerts,
    COUNT(*) FILTER (WHERE ma.alert_key LIKE '%possible fatigue%')::int AS possible_fatigue_alerts,
    COUNT(*) FILTER (
      WHERE ma.alert_key LIKE '%speed%'
         OR ma.alert_key LIKE '%speeding%'
    )::int AS speeding_alerts,
    MAX(ma.timestamp) AS last_alert_at
  FROM month_alerts ma
  GROUP BY ma.vehicle_key
),
ncr_counts AS (
  SELECT
    vn.vehicle_id,
    COUNT(*)::int AS ncr_total,
    COUNT(*) FILTER (WHERE vn.status <> 'closed')::int AS ncr_open
  FROM vehicle_ncrs vn
  GROUP BY vn.vehicle_id
),
profile_base AS (
  SELECT
    p.vehicle_id,
    COALESCE(NULLIF(p.device_id, ''), p.vehicle_id) AS device_id,
    COALESCE(NULLIF(p.display_name, ''), NULLIF(p.registration_number, ''), NULLIF(p.fleet_number, ''), p.vehicle_id) AS display_name,
    p.registration_number,
    p.fleet_number
  FROM vehicle_driver_card_profiles p
  WHERE p.is_active = true
)
SELECT
  p.vehicle_id,
  COALESCE(a.device_id, p.device_id) AS device_id,
  COALESCE(a.display_name, p.display_name) AS display_name,
  COALESCE(a.registration_number, p.registration_number) AS registration_number,
  COALESCE(a.fleet_number, p.fleet_number) AS fleet_number,
  COALESCE(a.total_alerts, 0) AS violations,
  GREATEST(0, 100 - FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) AS current_points,
  GREATEST(0, 100 - FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) AS rating,
  LEAST(100, FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) AS risk_score,
  CASE
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) >= 90 THEN 'Low Risk'
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) >= 75 THEN 'Medium Risk'
    ELSE 'High Risk'
  END AS risk_category,
  CASE
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) >= 90 THEN 'Gold'
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(a.total_alerts, 0) / 10.0)::int) >= 75 THEN 'Silver'
    ELSE 'Bronze'
  END AS performance_level,
  GREATEST(0, 100 - COALESCE(a.fatigue_alerts, 0)) AS fatigue_score,
  GREATEST(0, 100 - COALESCE(a.seatbelt_alerts, 0)) AS seatbelt_score,
  GREATEST(0, 100 - COALESCE(a.lane_deviation_alerts, 0)) AS lane_deviation_score,
  GREATEST(0, 100 - COALESCE(a.possible_fatigue_alerts, 0)) AS possible_fatigue_score,
  GREATEST(0, 100 - COALESCE(a.speeding_alerts, 0)) AS speeding_score,
  COALESCE(a.fatigue_alerts, 0) AS fatigue_alerts,
  COALESCE(a.seatbelt_alerts, 0) AS seatbelt_alerts,
  COALESCE(a.lane_deviation_alerts, 0) AS lane_deviation_alerts,
  COALESCE(a.possible_fatigue_alerts, 0) AS possible_fatigue_alerts,
  COALESCE(a.speeding_alerts, 0) AS speeding_alerts,
  COALESCE(n.ncr_total, 0) AS ncr_total,
  COALESCE(n.ncr_open, 0) AS ncr_open,
  a.last_alert_at
FROM profile_base p
LEFT JOIN alert_agg a
  ON a.vehicle_key = p.vehicle_id
LEFT JOIN ncr_counts n
  ON n.vehicle_id = p.vehicle_id
ORDER BY current_points DESC, violations ASC, display_name ASC;

COMMIT;

-- Useful read query:
-- SELECT * FROM vehicle_driver_card_standings_mtd;
