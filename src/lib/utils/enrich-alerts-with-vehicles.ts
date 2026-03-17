// Enrich video alerts with vehicle registration data from vehiclesc table
// Uses the camera_serial or device_id to lookup registration numbers

const vehicleCache = new Map<string, any>();

export async function enrichAlertsWithVehicleData(alerts: any[]): Promise<any[]> {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return alerts;
  }

  // Batch enrichment to avoid N+1 requests
  const enrichedAlerts = await Promise.all(
    alerts.map(alert => enrichSingleAlert(alert))
  );

  return enrichedAlerts;
}

async function enrichSingleAlert(alert: any): Promise<any> {
  if (!alert) return alert;

  // Skip if already has registration
  if (alert.vehicle_registration && alert.vehicle_registration !== 'N/A' && !alert.vehicle_registration.includes('Unknown')) {
    return alert;
  }

  // Try to find a lookup key
  const lookupKey =
    alert.camera_serial ||
    alert.camera_sim_id ||
    alert.device_id ||
    alert.target;

  if (!lookupKey) {
    return alert;
  }

  // Check cache first
  if (vehicleCache.has(lookupKey)) {
    const cachedVehicle = vehicleCache.get(lookupKey);
    if (cachedVehicle?.registration_number) {
      return {
        ...alert,
        vehicle_registration: cachedVehicle.registration_number,
        fleet_number: cachedVehicle.fleet_number || alert.fleet_number,
        vehicle_type: cachedVehicle.vehicle_type || alert.vehicle_type,
        driver_name: cachedVehicle.driver_name || alert.driver_name,
      };
    }
    // Skip if cache indicates no match
    return alert;
  }

  try {
    // Try camera_serial first
    let response = await fetch(
      `/api/vehicles/lookup-by-camera?camera_serial=${encodeURIComponent(lookupKey)}`,
      { cache: 'no-store' }
    );

    if (!response.ok && lookupKey.length > 10) {
      // If camera_serial didn't work, try as camera_sim_id
      response = await fetch(
        `/api/vehicles/lookup-by-camera?camera_sim_id=${encodeURIComponent(lookupKey)}`,
        { cache: 'no-store' }
      );
    }

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.vehicle) {
        const vehicleData = data.vehicle;
        vehicleCache.set(lookupKey, vehicleData);
        
        return {
          ...alert,
          vehicle_registration: vehicleData.registration_number || alert.vehicle_registration,
          fleet_number: vehicleData.fleet_number || alert.fleet_number,
          vehicle_type: vehicleData.vehicle_type || alert.vehicle_type,
          driver_name: vehicleData.driver_name || alert.driver_name,
        };
      }
    }

    // Cache miss
    vehicleCache.set(lookupKey, null);
  } catch (error) {
    console.error(`Failed to enrich alert with vehicle data for ${lookupKey}:`, error);
  }

  return alert;
}

// Clear cache periodically to ensure fresh data
export function clearVehicleCache(): void {
  vehicleCache.clear();
}

// Set cache duration
let cacheDuration = 5 * 60 * 1000; // 5 minutes default
const cacheTimestamps = new Map<string, number>();

export function setCacheDuration(ms: number): void {
  cacheDuration = ms;
}

export function pruneExpiredCacheEntries(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [key, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > cacheDuration) {
      toDelete.push(key);
    }
  }

  toDelete.forEach(key => {
    vehicleCache.delete(key);
    cacheTimestamps.delete(key);
  });
}
