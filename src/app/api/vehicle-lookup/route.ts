import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'deviceId required' }, { status: 400 });
    }

    const supabase = createClient();
    
    const { data: vehicle, error } = await supabase
      .from('vehiclesc')
      .select('registration_number, fleet_number, make, model, camera_serial, camera_sim_id')
      .eq('camera_sim_id', deviceId)
      .single();

    if (error || !vehicle) {
      return NextResponse.json({ 
        success: false, 
        plate: null,
        message: 'Vehicle not found' 
      });
    }

    return NextResponse.json({ 
      success: true, 
      plate: vehicle.registration_number,
      fleetNumber: vehicle.fleet_number,
      make: vehicle.make,
      model: vehicle.model
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
