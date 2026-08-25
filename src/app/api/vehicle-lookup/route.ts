import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type VehicleLookupEntry = {
  deviceId: string;
  plate: string | null;
  fleetNumber: string | null;
  make: string | null;
  model: string | null;
  costCenter: string | null;
  costCenterId: number | null;
  driverName: string | null;
  driverId: string | null;
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
    .select('registration_number, fleet_number, cost_centres, cost_center, cost_center_id, driver_id, drivers!vehiclesc_driver_id_fkey(first_name, surname, fleet_number, id)');

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: error.message,
      rows: [] as VehicleLookupEntry[],
    };
  }

  const { data: costCenterRows } = await supabase
    .from('cost_centers')
    .select('id, name, code');

  const costCenterByName = new Map<string, number>();
  const costCenterByCode = new Map<string, number>();
  const costCenterById = new Map<number, string>();
  for (const cc of costCenterRows || []) {
    const id = Number(cc.id);
    const name = String(cc.name || '').trim().toLowerCase();
    const code = String(cc.code || '').trim().toLowerCase();
    if (name) costCenterByName.set(name, id);
    if (code) costCenterByCode.set(code, id);
    if (id && cc.name) costCenterById.set(id, cc.name.trim());
  }

  const resolveCostCenterId = (textValue: string | null, existingId: number | null): number | null => {
    if (existingId) return existingId;
    if (!textValue) return null;
    const normalized = textValue.trim().toLowerCase();
    if (costCenterByName.has(normalized)) return costCenterByName.get(normalized)!;
    if (costCenterByCode.has(normalized)) return costCenterByCode.get(normalized)!;
    for (const [name, id] of costCenterByName) {
      if (normalized.includes(name) || name.includes(normalized)) return id;
    }
    return null;
  };

  const byDevice = new Map<string, VehicleLookupEntry>();
  const byPlate = new Map<string, VehicleLookupEntry>();
  for (const row of data || []) {
    const driver = (row as any).drivers;
    const driverName = driver ? `${driver.first_name || ''} ${driver.surname || ''}`.trim() : null;
    const costCenterText = cleanText(row.cost_center) || cleanText(row.cost_centres);
    const costCenterIdRaw = (row as any).cost_center_id ? Number((row as any).cost_center_id) : null;
    const costCenterId = resolveCostCenterId(costCenterText, costCenterIdRaw);
    const costCenterDisplay = costCenterText || (costCenterId ? costCenterById.get(costCenterId) || null : null);
    const rowValues = {
      plate: cleanText(row.registration_number),
      fleetNumber: cleanText(row.fleet_number),
      make: '',
      model: '',
      costCenter: costCenterDisplay,
      costCenterId: costCenterId,
      driverName: driverName || null,
      driverId: cleanText((row as any).driver_id),
    };

    const fleetNum = String(row.fleet_number ?? '').trim().toUpperCase();
    if (fleetNum) {
      byDevice.set(fleetNum, {
        deviceId: fleetNum,
        ...rowValues,
      });
    }

    const plate = String(row.registration_number ?? '').trim().toUpperCase();
    if (plate) {
      byPlate.set(plate, {
        deviceId: fleetNum || plate,
        ...rowValues,
      });
    }
  }

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
        .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id, cost_centres')
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
            const vDriver = (vehicle as any).drivers;
            const vDriverName = vDriver ? `${vDriver.first_name || ''} ${vDriver.surname || ''}`.trim() : null;
            rows.push({
              deviceId: String(vehicle.camera_sim_id),
              plate: cleanText(vehicle.registration_number),
              fleetNumber: cleanText(vehicle.fleet_number),
              make: cleanText(vehicle.make),
              model: cleanText(vehicle.model),
              costCenter: cleanText(vehicle.cost_centres),
              driverName: vDriverName || null,
              driverId: cleanText((vehicle as any).driver_id),
            });
          }

        if (vehicle.camera_serial && deviceIds.includes(String(vehicle.camera_serial))) {
            const vDriver = (vehicle as any).drivers;
            const vDriverName = vDriver ? `${vDriver.first_name || ''} ${vDriver.surname || ''}`.trim() : null;
            rows.push({
              deviceId: String(vehicle.camera_serial),
              plate: cleanText(vehicle.registration_number),
              fleetNumber: cleanText(vehicle.fleet_number),
              make: cleanText(vehicle.make),
              model: cleanText(vehicle.model),
              costCenter: cleanText(vehicle.cost_centres),
              driverName: vDriverName || null,
              driverId: cleanText((vehicle as any).driver_id),
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
          driverName: vehicle.driverName,
          driverId: vehicle.driverId,
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
      .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id, cost_centres')
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
              .select('registration_number, fleet_number, make, model, cost_centres, driver_id, drivers(first_name, surname)')
              .ilike('registration_number', registration)
              .limit(1)
              .maybeSingle();
            if (plateMatch) {
              const pmDriver = (plateMatch as any).drivers;
              const pmDriverName = pmDriver ? `${pmDriver.first_name || ''} ${pmDriver.surname || ''}`.trim() : null;
              return NextResponse.json({ success: true, plate: cleanText(plateMatch.registration_number), fleetNumber: cleanText(plateMatch.fleet_number), make: cleanText(plateMatch.make), model: cleanText(plateMatch.model), costCenter: cleanText(plateMatch.cost_centres), driverName: pmDriverName || null, driverId: cleanText((plateMatch as any).driver_id) });
            }
          }
        }
      } catch {}
      return NextResponse.json({ success: false, plate: null, message: 'Vehicle not found' });
    }

    const vehicleDriver = (vehicle as any).drivers;
    const vehicleDriverName = vehicleDriver ? `${vehicleDriver.first_name || ''} ${vehicleDriver.surname || ''}`.trim() : null;
    return NextResponse.json({ 
      success: true, 
      plate: cleanText(vehicle.registration_number),
      fleetNumber: cleanText(vehicle.fleet_number),
      make: cleanText(vehicle.make),
      model: cleanText(vehicle.model),
      costCenter: cleanText(vehicle.cost_centres),
      driverName: vehicleDriverName || null,
      driverId: cleanText((vehicle as any).driver_id)
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
