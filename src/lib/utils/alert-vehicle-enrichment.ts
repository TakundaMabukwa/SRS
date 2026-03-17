import { createClient } from '@/lib/supabase/client'

export interface AlertWithVehicleInfo {
  id: string
  device_id?: string
  camera_serial?: string
  camera_sim_id?: string
  vehicle_registration?: string
  fleet_number?: string
  driver_name?: string
  timestamp: string
  [key: string]: any
}

/**
 * Enriches an alert with vehicle information by looking up camera serial/sim in vehiclesc table
 */
export async function enrichAlertWithVehicleInfo(alert: any): Promise<AlertWithVehicleInfo> {
  try {
    const supabase = createClient()
    
    const cameraSerial = alert?.camera_serial || alert?.device_id
    const cameraSim = alert?.camera_sim_id
    
    if (!cameraSerial && !cameraSim) {
      return alert
    }

    let query = supabase.from('vehiclesc').select('fleet_number, registration_number, vehicle_type, driver_name')

    if (cameraSerial) {
      query = query.or(`camera_serial.eq.${cameraSerial},device_id.eq.${cameraSerial}`)
    }
    if (cameraSim) {
      query = query.or(`camera_sim_id.eq.${cameraSim}`)
    }

    const { data } = await query.single().catch(() => ({ data: null }))

    if (data) {
      return {
        ...alert,
        fleet_number: data.fleet_number,
        vehicle_registration: data.registration_number || alert.vehicle_registration,
        driver_name: data.driver_name || alert.driver_name
      }
    }

    return alert
  } catch (error) {
    console.error('Error enriching alert:', error)
    return alert
  }
}

/**
 * Batch enrich multiple alerts with vehicle information
 */
export async function enrichAlertsWithVehicleInfo(alerts: any[]): Promise<AlertWithVehicleInfo[]> {
  try {
    const supabase = createClient()
    
    // Collect unique camera identifiers
    const cameraIds = new Set<string>()
    const cameraSims = new Set<string>()
    
    alerts.forEach(alert => {
      if (alert.camera_serial || alert.device_id) {
        cameraIds.add(alert.camera_serial || alert.device_id)
      }
      if (alert.camera_sim_id) {
        cameraSims.add(alert.camera_sim_id)
      }
    })

    if (cameraIds.size === 0 && cameraSims.size === 0) {
      return alerts
    }

    // Fetch all relevant vehicles
    let query = supabase.from('vehiclesc').select('camera_serial, camera_sim_id, fleet_number, registration_number, device_id, vehicle_type, driver_name')

    const conditions: string[] = []
    
    if (cameraIds.size > 0) {
      const idList = Array.from(cameraIds).map(id => `camera_serial.eq.${id}`).join(',')
      conditions.push(idList)
    }
    
    if (cameraSims.size > 0) {
      const simList = Array.from(cameraSims).map(sim => `camera_sim_id.eq.${sim}`).join(',')
      conditions.push(simList)
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(','))
    }

    const { data: vehicles } = await query.catch(() => ({ data: [] }))

    if (!vehicles || vehicles.length === 0) {
      return alerts
    }

    // Create lookup map
    const vehicleMap = new Map<string, any>()
    vehicles.forEach(v => {
      if (v.camera_serial) vehicleMap.set(v.camera_serial, v)
      if (v.camera_sim_id) vehicleMap.set(v.camera_sim_id, v)
      if (v.device_id) vehicleMap.set(v.device_id, v)
    })

    // Enrich alerts
    return alerts.map(alert => {
      const key = alert.camera_serial || alert.device_id || alert.camera_sim_id
      const vehicleInfo = vehicleMap.get(key)

      if (vehicleInfo) {
        return {
          ...alert,
          fleet_number: vehicleInfo.fleet_number,
          vehicle_registration: vehicleInfo.registration_number || alert.vehicle_registration,
          driver_name: vehicleInfo.driver_name || alert.driver_name
        }
      }

      return alert
    })
  } catch (error) {
    console.error('Error batch enriching alerts:', error)
    return alerts
  }
}

/**
 * Get display name for vehicle (fleet_number or registration_number)
 */
export function getVehicleDisplayName(alert: AlertWithVehicleInfo, fallback: string = 'Unknown Vehicle'): string {
  if (alert.fleet_number) return alert.fleet_number
  if (alert.vehicle_registration) return alert.vehicle_registration
  if (alert.driver_name) return `Driver: ${alert.driver_name}`
  return fallback
}
