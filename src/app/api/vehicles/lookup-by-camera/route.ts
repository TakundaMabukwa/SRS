import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cameraSerial = searchParams.get('camera_serial')
    const cameraSim = searchParams.get('camera_sim_id')

    if (!cameraSerial && !cameraSim) {
      return NextResponse.json({ error: 'Missing camera_serial or camera_sim_id' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase.from('vehiclesc').select('fleet_number, registration_number, vehicle_type, driver_name')

    if (cameraSerial) {
      query = query.eq('camera_serial', cameraSerial)
    } else if (cameraSim) {
      query = query.eq('camera_sim_id', cameraSim)
    }

    const { data, error } = await query.single()

    if (error) {
      console.error('Vehicle lookup error:', error)
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      vehicle: {
        fleet_number: data?.fleet_number,
        registration_number: data?.registration_number,
        vehicle_type: data?.vehicle_type,
        driver_name: data?.driver_name
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
