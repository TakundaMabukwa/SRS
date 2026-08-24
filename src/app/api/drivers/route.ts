import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type DriverEntry = {
  id: string;
  first_name: string;
  surname: string;
  fleet_number: string | null;
  cell_number: string | null;
  license_number: string | null;
  license_expiry: string | null;
  pdp_expiry: string | null;
  cost_center_id: string | null;
  assigned_vehicle: {
    registration_number: string | null;
    make: string | null;
    model: string | null;
  } | null;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { rows: DriverEntry[]; byFleet: Map<string, DriverEntry>; expiresAt: number } = {
  rows: [],
  byFleet: new Map(),
  expiresAt: 0,
};

function clean(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fetchAll = ['1', 'true', 'yes'].includes(String(searchParams.get('all') ?? '').trim().toLowerCase());
    const fleetNumber = searchParams.get('fleet_number');

    if (cache.rows.length > 0 && Date.now() < cache.expiresAt) {
      if (fleetNumber) {
        const match = cache.byFleet.get(fleetNumber.toUpperCase());
        return NextResponse.json({ success: true, cached: true, drivers: match ? [match] : [] });
      }
      return NextResponse.json({ success: true, cached: true, drivers: cache.rows });
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: false, drivers: [], message: 'Supabase client unavailable' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('id, first_name, surname, fleet_number, cell_number, license_number, license_expiry_date, pdp_expiry_date, cost_center_id, vehiclesc!drivers_id_fkey(registration_number, make, model)')
      .eq('is_active', true)
      .order('surname');

    if (error) {
      return NextResponse.json({ success: false, drivers: [], message: error.message }, { status: 500 });
    }

    const rows: DriverEntry[] = (data || []).map((d: any) => {
      const vehicle = d.vehiclesc;
      return {
        id: String(d.id),
        first_name: clean(d.first_name) || '',
        surname: clean(d.surname) || '',
        fleet_number: clean(d.fleet_number),
        cell_number: clean(d.cell_number),
        license_number: clean(d.license_number),
        license_expiry: clean(d.license_expiry_date),
        pdp_expiry: clean(d.pdp_expiry_date),
        cost_center_id: clean(d.cost_center_id),
        assigned_vehicle: vehicle ? {
          registration_number: clean(vehicle.registration_number),
          make: clean(vehicle.make),
          model: clean(vehicle.model),
        } : null,
      };
    });

    const byFleet = new Map<string, DriverEntry>();
    for (const row of rows) {
      if (row.fleet_number) byFleet.set(row.fleet_number.toUpperCase(), row);
    }

    cache = { rows, byFleet, expiresAt: Date.now() + CACHE_TTL_MS };

    if (fleetNumber) {
      const match = byFleet.get(fleetNumber.toUpperCase());
      return NextResponse.json({ success: true, cached: false, drivers: match ? [match] : [] });
    }

    return NextResponse.json({ success: true, cached: false, drivers: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, drivers: [], error: error.message }, { status: 500 });
  }
}
