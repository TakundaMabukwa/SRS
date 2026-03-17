import { useCallback, useState, useEffect } from 'react'

interface VehicleInfo {
  fleet_number?: string
  registration_number?: string
  vehicle_type?: string
  driver_name?: string
}

export const useVehicleLookup = () => {
  const [cache, setCache] = useState<Record<string, VehicleInfo>>({})

  const lookupVehicle = useCallback(
    async (cameraSerial?: string, cameraSim?: string): Promise<VehicleInfo | null> => {
      const cacheKey = cameraSerial || cameraSim || ''
      
      // Return from cache if available
      if (cache[cacheKey]) {
        return cache[cacheKey]
      }

      if (!cameraSerial && !cameraSim) return null

      try {
        const params = new URLSearchParams()
        if (cameraSerial) params.append('camera_serial', cameraSerial)
        if (cameraSim) params.append('camera_sim_id', cameraSim)

        const response = await fetch(`/api/vehicles/lookup-by-camera?${params}`)
        
        if (!response.ok) return null

        const data = await response.json()
        
        if (data.success && data.vehicle) {
          setCache(prev => ({
            ...prev,
            [cacheKey]: data.vehicle
          }))
          return data.vehicle
        }

        return null
      } catch (error) {
        console.error('Vehicle lookup error:', error)
        return null
      }
    },
    [cache]
  )

  const getDisplayName = useCallback(
    (vehicleInfo: VehicleInfo | null, fallback: string = 'Unknown'): string => {
      if (!vehicleInfo) return fallback
      
      // Prefer fleet_number, then registration_number
      if (vehicleInfo.fleet_number) {
        return vehicleInfo.fleet_number
      }
      if (vehicleInfo.registration_number) {
        return vehicleInfo.registration_number
      }
      return fallback
    },
    []
  )

  return {
    lookupVehicle,
    getDisplayName,
    cache
  }
}
