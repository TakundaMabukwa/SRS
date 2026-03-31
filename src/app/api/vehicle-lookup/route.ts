import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');
    const deviceIdsRaw = searchParams.get('deviceIds');

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
        .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id')
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
        }> = [];

        if (vehicle.camera_sim_id && deviceIds.includes(String(vehicle.camera_sim_id))) {
          rows.push({
            deviceId: String(vehicle.camera_sim_id),
            plate: cleanText(vehicle.registration_number),
            fleetNumber: cleanText(vehicle.fleet_number),
            make: cleanText(vehicle.make),
            model: cleanText(vehicle.model),
          });
        }

        if (vehicle.camera_serial && deviceIds.includes(String(vehicle.camera_serial))) {
          rows.push({
            deviceId: String(vehicle.camera_serial),
            plate: cleanText(vehicle.registration_number),
            fleetNumber: cleanText(vehicle.fleet_number),
            make: cleanText(vehicle.make),
            model: cleanText(vehicle.model),
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
      .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id')
      .or(`camera_sim_id.eq.${deviceId},camera_serial.eq.${deviceId}`)
      .limit(1)
      .maybeSingle();

    if (error || !vehicle) {
      return NextResponse.json({ 
        success: false, 
        plate: null,
        message: 'Vehicle not found' 
      });
    }

    return NextResponse.json({ 
      success: true, 
      plate: cleanText(vehicle.registration_number),
      fleetNumber: cleanText(vehicle.fleet_number),
      make: cleanText(vehicle.make),
      model: cleanText(vehicle.model)
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
