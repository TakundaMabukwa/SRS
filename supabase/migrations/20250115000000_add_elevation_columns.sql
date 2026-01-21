-- Add elevation columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS elevate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS elevate_to text;

-- Add index for elevation queries
CREATE INDEX IF NOT EXISTS idx_trips_elevate ON public.trips (elevate, elevate_to) WHERE elevate = true;

-- Create trip history table to track changes
CREATE TABLE IF NOT EXISTS public.trip_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_id bigint NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  changed_by text NOT NULL,
  change_type text NOT NULL, -- 'edit', 'approve', 'reject'
  previous_data jsonb NOT NULL,
  new_data jsonb NOT NULL,
  change_reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for trip history queries
CREATE INDEX IF NOT EXISTS idx_trip_history_trip_id ON public.trip_history (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_history_change_type ON public.trip_history (change_type, created_at DESC);