import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type VehicleLookupEntry = {
  deviceId: string;
  plate: string | null;
  fleetNumber: string | null;
  make: string | null;
  model: string | null;
  costCenter: string | null;
};

const VEHICLE_LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000;
const EPS_SERVER = process.env.NEXT_PUBLIC_EPS_STREAMING_SERVER || 'http://localhost:3002';
const vehicleLookupCache: {
  rows: VehicleLookupEntry[];
  byDevice: Map<string, VehicleLookupEntry>;
  byPlate: Map<string, VehicleLookupEntry>;
  expiresAt: number;
} = {
  rows: [],
  byDevice: new Map(),
  byPlate: new Map(),
  expiresAt: 0,
};

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isVehicleLookupCacheFresh() {
  return vehicleLookupCache.rows.length > 0 && Date.now() < vehicleLookupCache.expiresAt;
}

function buildLookupCache(rows: VehicleLookupEntry[]) {
  const byDevice = new Map<string, VehicleLookupEntry>();
  const byPlate = new Map<string, VehicleLookupEntry>();
  for (const row of rows) {
    const deviceId = String(row?.deviceId || '').trim();
    if (deviceId) byDevice.set(deviceId, row);
    const plate = String(row?.plate || '').trim().toUpperCase();
    if (plate) byPlate.set(plate, row);
  }
  vehicleLookupCache.rows = rows;
  vehicleLookupCache.byDevice = byDevice;
  vehicleLookupCache.byPlate = byPlate;
  vehicleLookupCache.expiresAt = Date.now() + VEHICLE_LOOKUP_CACHE_TTL_MS;
}

async function fetchAllVehicleLookupRowsFromSupabase() {
  const supabase = await createClient();
  if (!supabase) {
    return {
      ok: false as const,
      status: 500,
      error: 'Supabase client unavailable',
      rows: [] as VehicleLookupEntry[],
    };
  }

  const { data, error } = await supabase
    .from('vehiclesc')
    .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id, cost_center');

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: error.message,
      rows: [] as VehicleLookupEntry[],
    };
  }

  const byDevice = new Map<string, VehicleLookupEntry>();
  const byPlate = new Map<string, VehicleLookupEntry>();
  for (const row of data || []) {
    const rowValues = {
      plate: cleanText(row.registration_number),
      fleetNumber: cleanText(row.fleet_number),
      make: cleanText(row.make),
      model: cleanText(row.model),
      costCenter: cleanText(row.cost_center),
    };

    const simId = String(row.camera_sim_id ?? '').trim();
    if (simId) {
      byDevice.set(simId, {
        deviceId: simId,
        ...rowValues,
      });
    }

    const serialId = String(row.camera_serial ?? '').trim();
    if (serialId) {
      byDevice.set(serialId, {
        deviceId: serialId,
        ...rowValues,
      });
    }

    const plate = String(row.registration_number ?? '').trim().toUpperCase();
    if (plate) {
      byPlate.set(plate, {
        deviceId: simId || serialId || plate,
        ...rowValues,
      });
    }
  }

  // Also match EPS devices by registration (plateName) so alerts with EPS deviceIds resolve correctly
  try {
    const epsRes = await fetch(`${EPS_SERVER}/api/stream/online`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (epsRes.ok) {
      const epsData = await epsRes.json();
      const epsDevices = epsData.data?.devices || [];
      for (const d of epsDevices) {
        if (!d.deviceId) continue;
        const plate = (d.plateName || '').trim();
        const registration = plate.split(' - ')[0].trim().toUpperCase();
        if (!registration || byDevice.has(d.deviceId)) continue;
        const match = byPlate.get(registration);
        if (match) {
          byDevice.set(d.deviceId, { deviceId: d.deviceId, ...match });
        }
      }
    }
  } catch {}

  const rows = Array.from(byDevice.values());
  buildLookupCache(rows);

  return {
    ok: true as const,
    status: 200,
    error: '',
    rows,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');
    const deviceIdsRaw = searchParams.get('deviceIds');
    const fetchAll = ['1', 'true', 'yes', 'on'].includes(
      String(searchParams.get('all') ?? '').trim().toLowerCase()
    );

    if (fetchAll) {
      if (isVehicleLookupCacheFresh()) {
        return NextResponse.json({
          success: true,
          cached: true,
          vehicles: vehicleLookupCache.rows,
        });
      }

      const fetched = await fetchAllVehicleLookupRowsFromSupabase();
      if (!fetched.ok) {
        return NextResponse.json({
          success: false,
          vehicles: [],
          message: fetched.error,
        }, { status: fetched.status });
      }

      return NextResponse.json({
        success: true,
        cached: false,
        vehicles: fetched.rows
      });
    }

    if (deviceIdsRaw) {
      const deviceIds = Array.from(
        new Set(
          deviceIdsRaw
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value && value !== 'undefined' && value !== 'null')
        )
      );

      if (deviceIds.length === 0) {
        return NextResponse.json({
          success: false,
          vehicles: [],
          message: 'Invalid or missing deviceIds'
        }, { status: 400 });
      }

      if (isVehicleLookupCacheFresh()) {
        const vehicles = deviceIds
          .map((deviceId) => vehicleLookupCache.byDevice.get(deviceId))
          .filter((row): row is VehicleLookupEntry => Boolean(row));
        return NextResponse.json({
          success: true,
          cached: true,
          vehicles
        });
      }

      const supabase = await createClient();
      if (!supabase) {
        return NextResponse.json({
          success: false,
          vehicles: [],
          message: 'Supabase client unavailable'
        }, { status: 500 });
      }

      const { data, error } = await supabase
        .from('vehiclesc')
        .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id, cost_center')
        .or(
          `camera_sim_id.in.(${deviceIds.join(',')}),camera_serial.in.(${deviceIds.join(',')})`
        );

      if (error) {
        return NextResponse.json({
          success: false,
          vehicles: [],
          message: error.message
        });
      }

      const vehicles = (data || []).flatMap((vehicle) => {
        const rows: Array<{
          deviceId: string | null;
          plate: string | null;
          fleetNumber: string | null;
          make: string | null;
          model: string | null;
          costCenter: string | null;
        }> = [];

        if (vehicle.camera_sim_id && deviceIds.includes(String(vehicle.camera_sim_id))) {
            rows.push({
              deviceId: String(vehicle.camera_sim_id),
              plate: cleanText(vehicle.registration_number),
              fleetNumber: cleanText(vehicle.fleet_number),
              make: cleanText(vehicle.make),
              model: cleanText(vehicle.model),
              costCenter: cleanText(vehicle.cost_center),
            });
          }

        if (vehicle.camera_serial && deviceIds.includes(String(vehicle.camera_serial))) {
            rows.push({
              deviceId: String(vehicle.camera_serial),
              plate: cleanText(vehicle.registration_number),
              fleetNumber: cleanText(vehicle.fleet_number),
              make: cleanText(vehicle.make),
              model: cleanText(vehicle.model),
              costCenter: cleanText(vehicle.cost_center),
            });
          }

        return rows;
      });

      return NextResponse.json({
        success: true,
        vehicles
      });
    }

    if (!deviceId || deviceId === 'undefined' || deviceId === 'null') {
      return NextResponse.json({ 
        success: false, 
        plate: null,
        message: 'Invalid or missing deviceId' 
      }, { status: 400 });
    }

    if (isVehicleLookupCacheFresh()) {
      const vehicle = vehicleLookupCache.byDevice.get(String(deviceId).trim());
      if (vehicle) {
        return NextResponse.json({
          success: true,
          cached: true,
          plate: vehicle.plate,
          fleetNumber: vehicle.fleetNumber,
          make: vehicle.make,
          model: vehicle.model,
          costCenter: vehicle.costCenter,
        });
      }
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        plate: null,
        message: 'Supabase client unavailable'
      }, { status: 500 });
    }
    
    const { data: vehicle, error } = await supabase
      .from('vehiclesc')
      .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id, cost_center')
      .or(`camera_sim_id.eq.${deviceId},camera_serial.eq.${deviceId}`)
      .limit(1)
      .maybeSingle();

    if (error || !vehicle) {
      // Fallback: match by registration from EPS plateName
      try {
        const epsRes = await fetch(`${EPS_SERVER}/api/stream/online`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
          cache: 'no-store', signal: AbortSignal.timeout(10000),
        });
        if (epsRes.ok) {
          const epsData = await epsRes.json();
          const epsDevices = epsData.data?.devices || [];
          const epsDevice = epsDevices.find((d: any) => d.deviceId === deviceId);
          if (epsDevice) {
            const plate = (epsDevice.plateName || '').trim();
            const registration = plate.split(' - ')[0].trim().toUpperCase();
            if (registration && isVehicleLookupCacheFresh()) {
              const cached = vehicleLookupCache.byPlate.get(registration);
              if (cached) {
                return NextResponse.json({ success: true, cached: true, ...cached });
              }
            }
            const { data: plateMatch } = await supabase
              .from('vehiclesc')
              .select('registration_number, fleet_number, make, model, cost_center')
              .ilike('registration_number', registration)
              .limit(1)
              .maybeSingle();
            if (plateMatch) {
              return NextResponse.json({ success: true, plate: cleanText(plateMatch.registration_number), fleetNumber: cleanText(plateMatch.fleet_number), make: cleanText(plateMatch.make), model: cleanText(plateMatch.model), costCenter: cleanText(plateMatch.cost_center) });
            }
          }
        }
      } catch {}
      return NextResponse.json({ success: false, plate: null, message: 'Vehicle not found' });
    }

    return NextResponse.json({ 
      success: true, 
      plate: cleanText(vehicle.registration_number),
      fleetNumber: cleanText(vehicle.fleet_number),
      make: cleanText(vehicle.make),
      model: cleanText(vehicle.model),
      costCenter: cleanText(vehicle.cost_center)
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
