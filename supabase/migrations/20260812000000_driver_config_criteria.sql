-- Driver Config Criteria table
CREATE TABLE IF NOT EXISTS driver_config_criteria (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  selected_weighting NUMERIC DEFAULT 10,
  actual_weighting NUMERIC DEFAULT 10,
  risk_tiers INTEGER DEFAULT 4,
  no_incidents INTEGER DEFAULT 0,
  statuses TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default criteria
INSERT INTO driver_config_criteria (name, selected_weighting, actual_weighting, risk_tiers, no_incidents, statuses) VALUES
  ('Speeding', 50.0, 50.0, 4, 4, ARRAY['Speed Exception 1', 'Speed Exception 2']),
  ('Harsh Accelerating', 10.0, 10.0, 4, 8, ARRAY['Safety - Acceleration - Aggressive', 'Safety - Acceleration - Dangerous']),
  ('Night Time Driving', 10.0, 10.0, 4, 4, '{}'),
  ('Excessive Day', 10.0, 10.0, 4, 15, '{}'),
  ('Harsh Braking', 10.0, 10.0, 4, 20, ARRAY['Safety - Braking - Dangerous', 'Safety - Braking - Aggressive']),
  ('Night Time Driving Excessive', 10.0, 10.0, 4, 4, '{}')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE driver_config_criteria ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated full access" ON driver_config_criteria
  FOR ALL USING (auth.role() = 'authenticated');
