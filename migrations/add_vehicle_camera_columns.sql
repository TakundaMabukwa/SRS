-- Create sequence if not exists
CREATE SEQUENCE IF NOT EXISTS vehiclesc_id_seq;

-- Set default for id column
ALTER TABLE public.vehiclesc ALTER COLUMN id SET DEFAULT nextval('vehiclesc_id_seq');

-- Set sequence ownership
ALTER SEQUENCE vehiclesc_id_seq OWNED BY public.vehiclesc.id;

ALTER TABLE public.vehiclesc
ADD COLUMN IF NOT EXISTS cash_rental text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS fleet_number text,
ADD COLUMN IF NOT EXISTS chassis_number text,
ADD COLUMN IF NOT EXISTS skylink_pro text,
ADD COLUMN IF NOT EXISTS skylink_serial text,
ADD COLUMN IF NOT EXISTS skylink_sim text,
ADD COLUMN IF NOT EXISTS skylink_data text,
ADD COLUMN IF NOT EXISTS panic_button text,
ADD COLUMN IF NOT EXISTS ican_device text,
ADD COLUMN IF NOT EXISTS beame_1 text,
ADD COLUMN IF NOT EXISTS camera_serial text,
ADD COLUMN IF NOT EXISTS camera_sim text,
ADD COLUMN IF NOT EXISTS camera_data text,
ADD COLUMN IF NOT EXISTS camera_sim_id text,
ADD COLUMN IF NOT EXISTS sd_card text,
ADD COLUMN IF NOT EXISTS techie_jc text,
ADD COLUMN IF NOT EXISTS installation_jc text,
ADD COLUMN IF NOT EXISTS installation_date date,
ADD COLUMN IF NOT EXISTS contract_end date,
ADD COLUMN IF NOT EXISTS deinstallation_jc text,
ADD COLUMN IF NOT EXISTS deinstallation_date date,
ADD COLUMN IF NOT EXISTS reinstallation_jc text,
ADD COLUMN IF NOT EXISTS reinstallation_date date,
ADD COLUMN IF NOT EXISTS deinstallation_2_jc text,
ADD COLUMN IF NOT EXISTS deinstallation_2_date date,
ADD COLUMN IF NOT EXISTS reinstallation_2_jc text,
ADD COLUMN IF NOT EXISTS reinstallation_2_date date;

CREATE INDEX IF NOT EXISTS idx_vehiclesc_fleet_number ON public.vehiclesc(fleet_number);
CREATE INDEX IF NOT EXISTS idx_vehiclesc_camera_serial ON public.vehiclesc(camera_serial);
