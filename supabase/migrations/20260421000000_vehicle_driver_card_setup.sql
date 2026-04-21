-- Vehicle driver-card setup
-- Purpose:
-- 1. Store a base vehicle profile row so every vehicle starts at 100
-- 2. Store NCRs linked to a vehicle/device and optionally to an alert
-- 3. Expose a simple month-to-date standings view derived from alerts
-- Matching priority:
--   a) device_id / server vehicle id
--   b) registration number fallback
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

-- Keep the setup idempotent and make the provided mapping the source of truth.
DELETE FROM vehicle_driver_card_profiles;

INSERT INTO vehicle_driver_card_profiles (
  vehicle_id,
  device_id,
  registration_number,
  display_name
)
VALUES
  ('221085864139','221085864139','KXZ493MP','KXZ493MP'),
  ('221085863974','221085863974','KXZ487MP','KXZ487MP'),
  ('221085899796','221085899796','JFP879FS','JFP879FS'),
  ('221087875570','221087875570','LDG433MP','LDG433MP'),
  ('221087882758','221087882758','JFP864FS','JFP864FS'),
  ('221085899648','221085899648','KVW508MP','KVW508MP'),
  ('221087865514','221087865514','LCZ936MP','LCZ936MP'),
  ('221087899117','221087899117','LCZ761MP','LCZ761MP'),
  ('221087905286','221087905286','JHD689FS','JHD689FS'),
  ('221087886932','221087886932','JGR332FS','JGR332FS'),
  ('221083721190','221083721190','KZL693MP','KZL693MP'),
  ('221083702554','221083702554','LDG415MP','LDG415MP'),
  ('221083648922','221083648922','LDR057MP','LDR057MP'),
  ('221083690478','221083690478','LDG421MP','LDG421MP'),
  ('221083667385','221083667385','KVR574MP','KVR574MP'),
  ('221083669290','221083669290','LDG425MP','LDG425MP'),
  ('221083667252','221083667252','KSG039MP','KSG039MP'),
  ('221083666502','221083666502','KZL671MP','KZL671MP'),
  ('221083639541','221083639541','KSG040MP','KSG040MP'),
  ('221083669142','221083669142','KVR579MP','KVR579MP'),
  ('221087900618','221087900618','JFP881FS','JFP881FS'),
  ('221087823034','221087823034','LDG067MP','LDG067MP'),
  ('221087889803','221087889803','JFP868FS','JFP868FS'),
  ('221087770581','221087770581','JGK731FS','JGK731FS'),
  ('221087866173','221087866173','LDG360MP','LDG360MP'),
  ('221087860556','221087860556','LDG451MP','LDG451MP'),
  ('221087882972','221087882972','JFW161FS','JFW161FS'),
  ('221087883046','221087883046','JGV562FS','JGV562FS'),
  ('221087915103','221087915103','JGV566FS','JGV566FS'),
  ('221085864956','221085864956','JGW959FS','JGW959FS'),
  ('221087900600','221087900600','JJT993FS','JJT993FS'),
  ('221085863073','221085863073','KXN238MP','KXN238MP'),
  ('221087916283','221087916283','JGV563FS','JGV563FS'),
  ('221087909072','221087909072','JGV564FS','JGV564FS'),
  ('221087891049','221087891049','LDG085MP','LDG085MP'),
  ('22108584684','22108584684','LDG076MP','LDG076MP'),
  ('221087892856','221087892856','KVW504FS','KVW504FS'),
  ('221085863875','221085863875','JGV758FS','JGV758FS'),
  ('221085865003','221085865003','JGR328FS','JGR328FS'),
  ('221087864921','221087864921','JGW953FS','JGW953FS'),
  ('221087885769','221087885769','LDG083MP','LDG083MP'),
  ('221085892999','221085892999','KZY937MP','KZY937MP'),
  ('291072232685','291072232685',NULL,'291072232685'),
  ('KXZ484MP',NULL,'KXZ484MP','KXZ484MP'),
  ('221085902475','221085902475','KZL673MP','KZL673MP'),
  ('221085864030','221085864030','KVW506MP','KVW506MP'),
  ('221087889035','221087889035','LDR065MP','LDR065MP'),
  ('221087920442','221087920442','JGW963FS','JGW963FS'),
  ('221085902798','221085902798','LDR067MP','LDR067MP'),
  ('221087888680','221087888680','LDG440MP','LDG440MP'),
  ('221083663558','221083663558','LDG443MP','LDG443MP'),
  ('221083648963','221083648963','LDG422MP','LDG422MP'),
  ('221083721646','221083721646','KSG035MP','KSG035MP'),
  ('221083656057','221083656057','KVR577MP','KVR577MP'),
  ('221083631472','221083631472','KSJ576MP','KSJ576MP'),
  ('221083632934','221083632934','KSJ572MP','KSJ572MP'),
  ('221083725399','221083725399','LDG428MP','LDG428MP'),
  ('221083633486','221083633486','LDG419MP','LDG419MP'),
  ('221083691195','221083691195','LDG436MP','LDG436MP'),
  ('221083649235','221083649235','LDG368MP','LDG368MP'),
  ('291072306323','291072306323','LDT526MP','LDT526MP'),
  ('221085890290','221085890290','JGV567FS','JGV567FS'),
  ('221085887296','221085887296','JGV565FS','JGV565FS'),
  ('221085887049','221085887049','JFW159FS','JFW159FS'),
  ('221087868252','221087868252','LCZ953MP','LCZ953MP'),
  ('221087884028','221087884028','KXN249MP','KXN249MP'),
  ('221085887502','221085887502','JHD701FS','JHD701FS'),
  ('221087890181','221087890181','KXG329MP','KXG329MP'),
  ('221087902309','221087902309','JFW153FS','JFW153FS'),
  ('221085888906','221085888906','JFP880FS','JFP880FS'),
  ('221085851136','221085851136','JGR342FS','JGR342FS'),
  ('221085888609','221085888609','JGW962FS','JGW962FS'),
  ('221085901998','221085901998','LCZ922MP','LCZ922MP'),
  ('221087920392','221087920392','JGW961FS','JGW961FS'),
  ('221087882949','221087882949','JFW162FS','JFW162FS'),
  ('221085886967','221085886967','KXZ498MP','KXZ498MP'),
  ('221085888039','221085888039','JFW163FS','JFW163FS'),
  ('221087866884','221087866884','JFP875FS','JFP875FS'),
  ('221085899465','221085899465','LCM197MP','LCM197MP'),
  ('221085902467','221085902467','KXN254MP','KXN254MP');

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
    NULLIF(BTRIM(a.device_id), '') AS device_id,
    NULLIF(
      UPPER(
        COALESCE(
          NULLIF(BTRIM(a.metadata->>'registration_number'), ''),
          NULLIF(BTRIM(a.metadata->>'vehicle_registration'), ''),
          NULLIF(BTRIM(a.metadata->>'plate'), ''),
          NULLIF(BTRIM(a.metadata->>'registration'), '')
        )
      ),
      ''
    ) AS registration_number,
    a.timestamp,
    LOWER(COALESCE(a.alert_type, '')) AS alert_key,
    COALESCE(
      NULLIF(BTRIM(a.metadata->>'fleet_number'), ''),
      NULLIF(BTRIM(a.metadata->>'fleetNumber'), ''),
      NULLIF(BTRIM(a.metadata->>'fleet'), '')
    ) AS fleet_number,
    COALESCE(
      NULLIF(BTRIM(a.metadata->>'driver_name'), ''),
      NULLIF(BTRIM(a.metadata->>'driverName'), ''),
      NULLIF(BTRIM(a.metadata->>'target_name'), ''),
      NULLIF(BTRIM(a.metadata->>'vehicle_registration'), ''),
      NULLIF(BTRIM(a.metadata->>'registration_number'), ''),
      NULLIF(BTRIM(a.metadata->>'fleet_number'), ''),
      NULLIF(BTRIM(a.device_id), '')
    ) AS display_name
  FROM alerts a
  WHERE NULLIF(BTRIM(a.device_id), '') IS NOT NULL
    AND a.timestamp >= date_trunc('month', now())
    AND a.timestamp < now()
),
alert_agg_by_device AS (
  SELECT
    ma.device_id AS match_device_id,
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
  GROUP BY ma.device_id
),
alert_agg_by_registration AS (
  SELECT
    ma.registration_number AS match_registration_number,
    MAX(ma.device_id) AS device_id,
    MAX(ma.display_name) AS display_name,
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
  WHERE ma.registration_number IS NOT NULL
  GROUP BY ma.registration_number
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
    NULLIF(BTRIM(p.device_id), '') AS device_id,
    NULLIF(UPPER(BTRIM(p.registration_number)), '') AS registration_number,
    COALESCE(
      NULLIF(BTRIM(p.display_name), ''),
      NULLIF(UPPER(BTRIM(p.registration_number)), ''),
      NULLIF(BTRIM(p.fleet_number), ''),
      NULLIF(BTRIM(p.device_id), ''),
      p.vehicle_id
    ) AS display_name,
    p.fleet_number
  FROM vehicle_driver_card_profiles p
  WHERE p.is_active = true
)
SELECT
  p.vehicle_id,
  COALESCE(ad.match_device_id, ar.device_id, p.device_id, p.vehicle_id) AS device_id,
  COALESCE(ad.display_name, ar.display_name, p.display_name) AS display_name,
  COALESCE(ad.registration_number, p.registration_number, ar.match_registration_number) AS registration_number,
  COALESCE(ad.fleet_number, ar.fleet_number, p.fleet_number) AS fleet_number,
  COALESCE(ad.total_alerts, ar.total_alerts, 0) AS violations,
  GREATEST(0, 100 - FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) AS current_points,
  GREATEST(0, 100 - FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) AS rating,
  LEAST(100, FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) AS risk_score,
  CASE
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) >= 90 THEN 'Low Risk'
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) >= 75 THEN 'Medium Risk'
    ELSE 'High Risk'
  END AS risk_category,
  CASE
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) >= 90 THEN 'Gold'
    WHEN GREATEST(0, 100 - FLOOR(COALESCE(ad.total_alerts, ar.total_alerts, 0) / 10.0)::int) >= 75 THEN 'Silver'
    ELSE 'Bronze'
  END AS performance_level,
  GREATEST(0, 100 - COALESCE(ad.fatigue_alerts, ar.fatigue_alerts, 0)) AS fatigue_score,
  GREATEST(0, 100 - COALESCE(ad.seatbelt_alerts, ar.seatbelt_alerts, 0)) AS seatbelt_score,
  GREATEST(0, 100 - COALESCE(ad.lane_deviation_alerts, ar.lane_deviation_alerts, 0)) AS lane_deviation_score,
  GREATEST(0, 100 - COALESCE(ad.possible_fatigue_alerts, ar.possible_fatigue_alerts, 0)) AS possible_fatigue_score,
  GREATEST(0, 100 - COALESCE(ad.speeding_alerts, ar.speeding_alerts, 0)) AS speeding_score,
  COALESCE(ad.fatigue_alerts, ar.fatigue_alerts, 0) AS fatigue_alerts,
  COALESCE(ad.seatbelt_alerts, ar.seatbelt_alerts, 0) AS seatbelt_alerts,
  COALESCE(ad.lane_deviation_alerts, ar.lane_deviation_alerts, 0) AS lane_deviation_alerts,
  COALESCE(ad.possible_fatigue_alerts, ar.possible_fatigue_alerts, 0) AS possible_fatigue_alerts,
  COALESCE(ad.speeding_alerts, ar.speeding_alerts, 0) AS speeding_alerts,
  COALESCE(n.ncr_total, 0) AS ncr_total,
  COALESCE(n.ncr_open, 0) AS ncr_open,
  COALESCE(ad.last_alert_at, ar.last_alert_at) AS last_alert_at
FROM profile_base p
LEFT JOIN alert_agg_by_device ad
  ON p.device_id IS NOT NULL
 AND ad.match_device_id = p.device_id
LEFT JOIN alert_agg_by_registration ar
  ON ad.match_device_id IS NULL
 AND p.registration_number IS NOT NULL
 AND ar.match_registration_number = p.registration_number
LEFT JOIN ncr_counts n
  ON n.vehicle_id = p.vehicle_id
ORDER BY current_points DESC, violations ASC, display_name ASC;

COMMIT;

-- Useful read query:
-- SELECT * FROM vehicle_driver_card_standings_mtd;
