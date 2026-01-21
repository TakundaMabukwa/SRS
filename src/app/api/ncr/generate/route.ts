import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { driverId, speedingEvents } = await req.json();

    if (!driverId || !speedingEvents || speedingEvents.length < 3) {
      return NextResponse.json({ 
        success: false, 
        error: 'Minimum 3 speeding events required' 
      }, { status: 400 });
    }

    const supabase = createClient();
    
    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (!driver) {
      return NextResponse.json({ success: false, error: 'Driver not found' }, { status: 404 });
    }

    const latestEvent = speedingEvents[0];
    
    // Lookup vehicle registration from device_id
    let vehicleReg = latestEvent.vehicleId || 'Unknown';
    let fleetNumber = 'Unknown';
    if (latestEvent.device_id) {
      const { data: vehicle } = await supabase
        .from('vehiclesc')
        .select('registration_number, fleet_number')
        .eq('camera_sim_id', latestEvent.device_id)
        .single();
      
      if (vehicle) {
        vehicleReg = vehicle.registration_number || vehicleReg;
        fleetNumber = vehicle.fleet_number || fleetNumber;
      }
    }
    
    const ncrData = {
      id: `NCR-${Date.now()}`,
      docNumber: 'Non-Conformance-00',
      revisionDate: new Date().toISOString().split('T')[0],
      driverName: `${driver.first_name} ${driver.surname}`,
      department: 'Operations',
      manager: 'Fleet Manager',
      section: 'Transport',
      dateRecorded: new Date(latestEvent.timestamp).toLocaleDateString('en-ZA'),
      timeRecorded: new Date(latestEvent.timestamp).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      duration: 'N/A',
      fleetNumber: `${vehicleReg} (${fleetNumber})`,
      location: `${latestEvent.latitude?.toFixed(4)}, ${latestEvent.longitude?.toFixed(4)}`,
      classification: {
        speeding: true,
        trafficViolation: true,
        recklessDriving: speedingEvents.some((e: any) => e.severity === 'severe'),
        negligence: speedingEvents.length >= 5,
        insubordination: false,
        noSeatbelt: false,
        unauthorizedPassenger: false,
        fatigue: false,
        other: false,
      },
      description: `Driver has accumulated ${speedingEvents.length} speeding violations:\n\n${speedingEvents.map((e: any, i: number) => 
        `${i + 1}. ${new Date(e.timestamp).toLocaleString()} - ${e.speed} km/h in ${e.speedLimit} km/h zone (${e.speed - e.speedLimit} km/h over)`
      ).join('\n')}`,
      rootCause: {
        unsafeActs: ['Excessive speed', 'Disregard for speed limits'],
        unsafeConditions: [],
        personalFactors: ['Repeated violations indicate pattern'],
      },
      riskRating: speedingEvents.some((e: any) => e.severity === 'severe') ? 'High' : 'Medium',
    };

    const { data: ncr, error } = await supabase
      .from('ncr_reports')
      .insert({
        ncr_id: ncrData.id,
        driver_id: driverId,
        ncr_data: ncrData,
        speeding_events: speedingEvents,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      ncr: ncrData,
      message: `NCR ${ncrData.id} auto-generated for ${speedingEvents.length} speeding violations` 
    });

  } catch (error: any) {
    console.error('NCR generation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ success: true, ncrs: [] });
    }

    // Fetch speeding alerts from video server
    const alertsRes = await fetch(`${process.env.NEXT_PUBLIC_VIDEO_SERVER_URL || 'http://localhost:3000'}/api/video-server/alerts?type=speeding&dateFrom=${dateFrom}&dateTo=${dateTo}`);
    
    if (!alertsRes.ok) {
      return NextResponse.json({ success: true, ncrs: [] });
    }

    const alertsData = await alertsRes.json();
    const alerts = alertsData.alerts || [];

    // Group alerts by device_id (vehicle)
    const vehicleGroups: any = {};
    
    for (const alert of alerts) {
      const deviceId = alert.device_id || 'unknown';
      if (!vehicleGroups[deviceId]) {
        vehicleGroups[deviceId] = {
          device_id: deviceId,
          alerts: [],
          violations: 0
        };
      }
      vehicleGroups[deviceId].alerts.push(alert);
      vehicleGroups[deviceId].violations++;
    }

    // Create NCR-like objects for each vehicle
    const supabase = createClient();
    const ncrs = [];

    for (const [deviceId, group] of Object.entries(vehicleGroups) as any) {
      // Lookup vehicle info
      const { data: vehicle } = await supabase
        .from('vehiclesc')
        .select('registration_number, fleet_number')
        .eq('camera_sim_id', deviceId)
        .single();

      const vehicleReg = vehicle?.registration_number || deviceId;
      const fleetNumber = vehicle?.fleet_number || 'Unknown';
      const driverName = group.alerts[0]?.driver_name || 'Unknown Driver';
      
      // Determine risk rating
      const highSpeedCount = group.alerts.filter((a: any) => a.severity === 'high' || a.speed_over_limit > 20).length;
      const riskRating = highSpeedCount >= 2 ? 'High' : group.violations >= 5 ? 'Medium' : 'Low';

      ncrs.push({
        id: `NCR-${deviceId}-${Date.now()}`,
        ncr_id: `NCR-${deviceId}-${dateFrom}`,
        device_id: deviceId,
        created_at: group.alerts[0]?.timestamp || new Date().toISOString(),
        status: 'pending',
        ncr_data: {
          id: `NCR-${deviceId}-${dateFrom}`,
          driverName,
          fleetNumber: `${vehicleReg} (${fleetNumber})`,
          department: 'Operations',
          riskRating,
          dateRecorded: dateFrom,
          violations: group.violations
        },
        speeding_events: group.alerts
      });
    }

    return NextResponse.json({ success: true, ncrs });
  } catch (error: any) {
    console.error('NCR GET error:', error);
    return NextResponse.json({ success: true, ncrs: [] });
  }
}
