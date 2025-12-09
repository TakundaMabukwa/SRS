"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SecureButton } from '@/components/SecureButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import { X, FileText, CheckCircle, AlertTriangle, Clock, TrendingUp, Plus, Route, MapPin } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'
import { ProgressWithWaypoints } from '@/components/ui/progress-with-waypoints'
import { RouteOptimizer } from '@/components/ui/route-optimizer'
import { RouteTracker } from '@/components/ui/route-tracker'
import { RoutePreviewMap } from '@/components/ui/route-preview-map'
import { RouteConfirmationModal } from '@/components/ui/route-confirmation-modal'
import { RouteEditModal } from '@/components/ui/route-edit-modal'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { CommodityDropdown } from '@/components/ui/commodity-dropdown'
import { ClientDropdown } from '@/components/ui/client-dropdown'
import { ClientNameDisplay } from '@/components/ui/client-name-display'
import { ClientAddressPopup } from '@/components/ui/client-address-popup'
import { Toast } from '@/components/ui/toast'
import { DriverDropdown } from '@/components/ui/driver-dropdown'
import { VehicleDropdown } from '@/components/ui/vehicle-dropdown'
import { VehicleTypeDropdown } from '@/components/ui/vehicle-type-dropdown'
import { TrailerDropdown } from '@/components/ui/trailer-dropdown'
import { StopPointDropdown } from '@/components/ui/stop-point-dropdown'
import { markDriversUnavailable } from '@/lib/utils/driver-availability'


export default function LoadPlanPage() {
  const supabase = createClient()
  const router = useRouter()
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', isVisible: false })
  const [isEditMode, setIsEditMode] = useState(false)
  const [editTripId, setEditTripId] = useState(null)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, isVisible: true })
  }
  const hideToast = () => setToast(prev => ({ ...prev, isVisible: false }))
  const [loads, setLoads] = useState([
    {
      id: 'test-1',
      trip_id: 'TEST-123',
      client: 'Test Client',
      commodity: 'Test Cargo',
      rate: '1000',
      startdate: '2025-01-15',
      enddate: '2025-01-16',
      status: 'pending',
      vehicleassignments: []
    }
  ])
  const [clients, setClients] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [costCenters, setCostCenters] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [vehicleTrackingData, setVehicleTrackingData] = useState([])

  // Create Load form state
  const [client, setClient] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [manualClientName, setManualClientName] = useState('')
  const [showAddressPopup, setShowAddressPopup] = useState(false)
  const [commodity, setCommodity] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [rate, setRate] = useState('')
  const [orderNumber, setOrderNumber] = useState(`ORD-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`)
  const [comment, setComment] = useState('')
  // Address & ETA section
  const [etaPickup, setEtaPickup] = useState('')
  const [loadingLocation, setLoadingLocation] = useState('')
  const [etaDropoff, setEtaDropoff] = useState('')
  const [dropOffPoint, setDropOffPoint] = useState('')
  const [showSecondSection, setShowSecondSection] = useState(false)
  const secondRef = useRef<HTMLDivElement | null>(null)
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Driver assignments state
  const [driverAssignments, setDriverAssignments] = useState([{ id: '', name: '' }])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedTrailerId, setSelectedTrailerId] = useState('')
  const [selectedVehicleType, setSelectedVehicleType] = useState('')
  const [selectedDriverLocation, setSelectedDriverLocation] = useState(null)
  
  // Cost calculation state
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState('21.55')
  const [estimatedDistance, setEstimatedDistance] = useState(0)
  const [approximateFuelCost, setApproximateFuelCost] = useState(0)
  const [approximatedCPK, setApproximatedCPK] = useState(0)
  const [approximatedVehicleCost, setApproximatedVehicleCost] = useState(0)
  const [approximatedDriverCost, setApproximatedDriverCost] = useState(0)
  const [totalVehicleCost, setTotalVehicleCost] = useState(0)
  const [goodsInTransitPremium, setGoodsInTransitPremium] = useState('')
  const [tripType, setTripType] = useState('local')
  const [stopPoints, setStopPoints] = useState([])
  const [availableStopPoints, setAvailableStopPoints] = useState([])
  const [isLoadingStopPoints, setIsLoadingStopPoints] = useState(false)
  const [customStopPoints, setCustomStopPoints] = useState([])
  const [tripDays, setTripDays] = useState(1)
  const [isManuallyOrdered, setIsManuallyOrdered] = useState(false)

  // Rate Card System - Variable Costs
  const RATE_CARD_SYSTEM = {
    'TAUTLINER': {
      fuel_rate: 4070,      // R4,070 fuel component
      base_rate: 7280,      // R7,280 base rate
      ppk: 3.00,           // R3.00 per km
      profit_margin: 0.111, // 11.1%
      extra_stop: 0,       // No extra stop cost
    },
    'TAUT X-BRDER - BOTSWANA': {
      fuel_rate: 3500,
      base_rate: 6500,
      ppk: 2.80,
      profit_margin: 0.10,
      extra_stop: 500,
    },
    'TAUT X-BRDER - NAMIBIA': {
      fuel_rate: 3800,
      base_rate: 7000,
      ppk: 2.90,
      profit_margin: 0.10,
      extra_stop: 500,
    },
    'CITRUS LOAD (+1 DAY STANDING FPT)': {
      fuel_rate: 4070,
      base_rate: 7280,
      ppk: 3.00,
      profit_margin: 0.111,
      extra_stop: 0,
      standing_day_cost: 2000, // Extra standing day cost
    },
    '14M/15M COMBO (NEW)': {
      fuel_rate: 3200,
      base_rate: 6800,
      ppk: 2.50,
      profit_margin: 0.12,
      extra_stop: 300,
    },
    '14M/15M REEFER': {
      fuel_rate: 3500,
      base_rate: 7500,
      ppk: 2.80,
      profit_margin: 0.12,
      extra_stop: 400,
    },
    '9 METER (NEW)': {
      fuel_rate: 2800,
      base_rate: 5500,
      ppk: 2.20,
      profit_margin: 0.11,
      extra_stop: 250,
    },
    '8T JHB (NEW - EPS)': {
      fuel_rate: 2200,
      base_rate: 4800,
      ppk: 1.80,
      profit_margin: 0.10,
      extra_stop: 200,
    },
    '8T JHB (NEW) - X-BRDER - MOZ': {
      fuel_rate: 2400,
      base_rate: 5200,
      ppk: 1.90,
      profit_margin: 0.10,
      extra_stop: 300,
    },
    '8T JHB (OLD)': {
      fuel_rate: 2000,
      base_rate: 4200,
      ppk: 1.60,
      profit_margin: 0.09,
      extra_stop: 150,
    },
    '14 TON CURTAIN': {
      fuel_rate: 3400,
      base_rate: 6200,
      ppk: 2.60,
      profit_margin: 0.11,
      extra_stop: 350,
    },
    '1TON BAKKIE': {
      fuel_rate: 1200,
      base_rate: 2800,
      ppk: 1.20,
      profit_margin: 0.08,
      extra_stop: 100,
    },
  }

  // Fetch loads and reference data
  // Fetch stop points with pagination and caching
  const fetchStopPoints = async () => {
    if (availableStopPoints.length > 0) return // Already loaded
    
    setIsLoadingStopPoints(true)
    try {
      const { data: stopPointsData, error: stopPointsError } = await supabase
        .from('stop_points')
        .select('id, name, name2, coordinates')
        .order('name')
        // .limit(1000) // Removed limit to get all stop points
      
      if (stopPointsError) {
        console.error('Stop points error:', stopPointsError)
      } else {
        setAvailableStopPoints(stopPointsData || [])
      }
    } catch (err) {
      console.error('Error fetching stop points:', err)
    }
    setIsLoadingStopPoints(false)
  }

  const fetchData = async () => {
    console.log('Starting fetchData...')
    try {
      console.log('Fetching from Supabase...')
      const [
        { data: loadsData, error: loadsError },
        { data: clientsData, error: clientsError },
        { data: vehiclesData, error: vehiclesError },
        { data: driversData, error: driversError },
        { data: costCentersData, error: costCentersError },
        trackingResponse
      ] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        fetch('/api/eps-client-list').then(res => res.json()).then(data => ({ data: data.data, error: null })).catch(error => ({ data: null, error })),
        supabase.from('vehiclesc').select('id, registration_number, engine_number, vin_number, make, model, sub_model, manufactured_year, vehicle_type').eq('veh_dormant_flag', false),
        supabase.from('drivers').select('*'),
        supabase.from('cost_centers').select('*'),
        fetch('http://64.227.138.235:3000/api/eps-vehicles')
      ])
      

      
      console.log('Supabase errors:', { loadsError, clientsError, vehiclesError, driversError, costCentersError })
      
      const trackingData = await trackingResponse.json()
      const vehicleData = trackingData?.result?.data || trackingData?.data || trackingData || []
      
      // Format drivers from drivers table
      const formattedDrivers = (driversData || []).map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.surname}`.trim(),
        first_name: driver.first_name || '',
        surname: driver.surname || '',
        available: driver.available
      }))
      
      // Filter available drivers
      const availableDriversList = formattedDrivers.filter(d => d.available === true)
      
      // Helper function to parse JSON fields
      const parseJsonField = (field) => {
        if (!field) return null
        if (typeof field === 'object') return field
        try {
          return JSON.parse(field)
        } catch {
          return null
        }
      }
      
      // Convert trip data to load format for display
      const loadData = (loadsData || []).map(trip => {
        const clientDetails = parseJsonField(trip.clientdetails)
        const pickupLocations = parseJsonField(trip.pickuplocations)
        const dropoffLocations = parseJsonField(trip.dropofflocations)
        
        return {
          ...trip,
          client: clientDetails?.name || '',
          commodity: trip.cargo || '',
          etaPickup: pickupLocations?.[0]?.scheduled_time || trip.startdate || '',
          etaDropoff: dropoffLocations?.[0]?.scheduled_time || trip.enddate || '',
          loadingLocation: trip.origin || '',
          dropOffPoint: trip.destination || ''
        }
      })
      
      console.log('Raw loads data:', loadsData)
      console.log('Raw loads count:', loadsData?.length || 0)
      console.log('Processed load data:', loadData)
      console.log('Processed loads count:', loadData?.length || 0)
      
      setLoads(loadData)
      setClients(clientsData || [])
      setVehicles(vehiclesData || [])
      setDrivers(formattedDrivers)
      setAvailableDrivers(availableDriversList)
      setVehicleTrackingData(vehicleData)
      setCostCenters(costCentersData || [])
      setAvailableStopPoints([])
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Vehicle type options
  const vehicleTypeOptions = [
    'TAUTLINER',
    'TAUT X-BRDER - BOTSWANA',
    'TAUT X-BRDER - NAMIBIA', 
    'CITRUS LOAD (+1 DAY STANDING FPT)',
    '14M/15M COMBO (NEW)',
    '14M/15M REEFER',
    '9 METER (NEW)',
    '8T JHB (NEW - EPS)',
    '8T JHB (NEW) - X-BRDER - MOZ',
    '8T JHB (OLD)',
    '14 TON CURTAIN',
    '1TON BAKKIE'
  ]

  // Filter vehicles based on selected type
  const filteredVehicles = useMemo(() => {
    if (!selectedVehicleType) return vehicles
    
    const keywords = {
      'TAUTLINER': ['taut', 'liner'],
      'TAUT X-BRDER - BOTSWANA': ['taut', 'botswana', 'x-border'],
      'TAUT X-BRDER - NAMIBIA': ['taut', 'namibia', 'x-border'],
      'CITRUS LOAD (+1 DAY STANDING FPT)': ['citrus', 'fpt'],
      '14M/15M COMBO (NEW)': ['14m', '15m', 'combo'],
      '14M/15M REEFER': ['14m', '15m', 'reefer'],
      '9 METER (NEW)': ['9m', '9 meter'],
      '8T JHB (NEW - EPS)': ['8t', '8 ton', 'jhb'],
      '8T JHB (NEW) - X-BRDER - MOZ': ['8t', '8 ton', 'jhb', 'moz'],
      '8T JHB (OLD)': ['8t', '8 ton', 'jhb', 'old'],
      '14 TON CURTAIN': ['14 ton', 'curtain'],
      '1TON BAKKIE': ['1 ton', 'bakkie']
    }
    
    const typeKeywords = keywords[selectedVehicleType] || []
    
    return vehicles.filter(vehicle => {
      const searchText = `${vehicle.model || vehicle.make || ''}`.toLowerCase()
      return typeKeywords.some(keyword => searchText.includes(keyword.toLowerCase()))
    })
  }, [vehicles, selectedVehicleType])

  // Memoized vehicle and driver lookups
  const vehicleMap = useMemo(() => 
    new Map(vehicles.map(v => [v.id, v.registration_number])), [vehicles]
  )
  
  const driverMap = useMemo(() => 
    new Map(drivers.map(d => [d.id, `${d.first_name} ${d.surname}`])), [drivers]
  )

  // Calculate distance between two coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }, [])

  // Get pickup location coordinates using Mapbox
  const getPickupCoordinates = useCallback(async (location) => {
    if (!location) return null
    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!mapboxToken) return null
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}&country=za&limit=1`
      )
      const data = await response.json()
      if (data.features?.[0]?.center) {
        const [lon, lat] = data.features[0].center
        return { lat, lon }
      }
    } catch (error) {
      console.error('Error geocoding pickup location:', error)
    }
    return null
  }, [])

  // Get sorted drivers by distance from pickup location
  const getSortedDriversByDistance = useCallback(async (pickupLocation) => {
    if (!pickupLocation) return drivers
    
    const pickupCoords = await getPickupCoordinates(pickupLocation)
    if (!pickupCoords) return drivers
    
    // Use stored vehicle tracking data
    const driversWithDistance = drivers.map(driver => {
      // Find matching vehicle by driver name
      const trackingData = Array.isArray(vehicleTrackingData) ? vehicleTrackingData : []
      const driverFullName = `${driver.first_name} ${driver.surname}`.trim().toLowerCase()
      const matchingVehicle = trackingData.find(vehicle => 
        vehicle.driver_name && 
        vehicle.driver_name.toLowerCase() === driverFullName
      )
      
      if (matchingVehicle?.latitude && matchingVehicle?.longitude) {
        const distance = calculateDistance(
          pickupCoords.lat, pickupCoords.lon,
          parseFloat(matchingVehicle.latitude), parseFloat(matchingVehicle.longitude)
        )
        return { ...driver, distance: Math.round(distance * 10) / 10 }
      }
      
      return { ...driver, distance: null }
    })
    
    // Sort by distance (closest first, then drivers without coordinates)
    return driversWithDistance.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return a.distance - b.distance
    })
  }, [drivers, calculateDistance, getPickupCoordinates, vehicleTrackingData])

  // State for sorted drivers
  const [sortedDrivers, setSortedDrivers] = useState(drivers)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)



  // Preview route when locations change - get Mapbox timing data
  useEffect(() => {
    const previewRoute = async () => {
      console.log('Route preview triggered:', { loadingLocation, dropOffPoint, stopPoints, customStopPoints })
      if (!loadingLocation || !dropOffPoint) {
        setOptimizedRoute(null)
        return
      }
      
      setIsOptimizing(true)
      try {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!mapboxToken) {
          setIsOptimizing(false)
          return
        }
        
        // Check if we have driver location for complete route
        const firstDriver = driverAssignments[0]
        let driverLocation = null
        
        if (firstDriver?.id) {
          const driver = drivers.find(d => d.id === firstDriver.id)
          if (driver) {
            const driverFullName = `${driver.first_name} ${driver.surname}`.trim().toLowerCase()
            const trackingData = Array.isArray(vehicleTrackingData) ? vehicleTrackingData : []
            const matchingVehicle = trackingData.find(vehicle => 
              vehicle.driver_name && 
              vehicle.driver_name.toLowerCase() === driverFullName
            )
            
            if (matchingVehicle?.latitude && matchingVehicle?.longitude) {
              driverLocation = {
                lat: parseFloat(matchingVehicle.latitude),
                lng: parseFloat(matchingVehicle.longitude)
              }
            }
          }
        }
        
        // Get stop points data if available
        let stopPointsData = []
        if (stopPoints.length > 0 || customStopPoints.some(p => p)) {
          try {
            stopPointsData = await getSelectedStopPointsData()
            console.log('Stop points data for route:', stopPointsData)
            // Filter out invalid stop points
            stopPointsData = stopPointsData.filter(point => 
              point && point.coordinates && point.coordinates.length > 0
            )
          } catch (error) {
            console.error('Error getting stop points data:', error)
            stopPointsData = []
          }
        }
        
        // Geocode loading and drop-off locations
        const [loadingResponse, dropOffResponse] = await Promise.all([
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loadingLocation)}.json?access_token=${mapboxToken}&country=za&limit=1`),
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropOffPoint)}.json?access_token=${mapboxToken}&country=za&limit=1`)
        ])
        
        const [loadingData, dropOffData] = await Promise.all([
          loadingResponse.json(),
          dropOffResponse.json()
        ])
        
        if (loadingData.features?.[0] && dropOffData.features?.[0]) {
          const loadingCoords = loadingData.features[0].center
          const dropOffCoords = dropOffData.features[0].center
          
          // Build waypoints string including stop points
          let waypoints = `${loadingCoords[0]},${loadingCoords[1]}`
          
          // Add stop points as waypoints
          if (stopPointsData.length > 0) {
            const stopWaypoints = stopPointsData.map(point => {
              const coords = point.coordinates
              const avgLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length
              const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length
              return `${avgLng},${avgLat}`
            }).filter(waypoint => waypoint && !waypoint.includes('NaN'))
            
            if (stopWaypoints.length > 0) {
              waypoints += `;${stopWaypoints.join(';')}`
            }
          }
          
          waypoints += `;${dropOffCoords[0]},${dropOffCoords[1]}`
          
          // If we have driver location, create complete route: driver → loading → stops → drop-off
          if (driverLocation) {
            waypoints = `${driverLocation.lng},${driverLocation.lat};${waypoints}`
          }
          
          console.log('Calculating route with waypoints:', waypoints)
          
          // Always use directions API for now to avoid complexity
          const apiEndpoint = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}`
          const apiParams = 'geometries=geojson&overview=full&annotations=duration,distance&exclude=ferry'
          
          const directionsResponse = await fetch(
            `${apiEndpoint}?access_token=${mapboxToken}&${apiParams}`
          )
          
          if (!directionsResponse.ok) {
            console.error('API request failed:', directionsResponse.status, directionsResponse.statusText)
            setOptimizedRoute(null)
            return
          }
          
          const directionsData = await directionsResponse.json()
          console.log('Directions API response:', directionsData)
          
          if (directionsData.code !== 'Ok') {
            console.error('API returned error:', directionsData)
            setOptimizedRoute(null)
            return
          }
          
          const route = directionsData.routes?.[0]
          if (route) {
            const routeInfo = {
              route: route,
              distance: route.distance,
              duration: route.duration,
              hasDriverLocation: !!driverLocation,
              stopPoints: stopPointsData,
              geometry: route.geometry
            }
            console.log('Setting optimized route:', routeInfo)
            setOptimizedRoute(routeInfo)
          } else {
            console.error('No routes found:', directionsData)
            setOptimizedRoute(null)
          }
        }
      } catch (error) {
        console.error('Route preview failed:', error)
        setOptimizedRoute(null)
      }
      setIsOptimizing(false)
    }
    
    // Add a small delay to prevent too frequent updates
    const timeoutId = setTimeout(previewRoute, 500)
    return () => clearTimeout(timeoutId)
  }, [loadingLocation, dropOffPoint, stopPoints, customStopPoints, driverAssignments, isManuallyOrdered])



  // Update sorted drivers when pickup location changes
  useEffect(() => {
    if (loadingLocation) {
      // Refresh vehicle tracking data when location changes
      fetch('http://64.227.138.235:3000/api/eps-vehicles')
        .then(response => response.json())
        .then(trackingData => {
          const vehicleData = trackingData?.result?.data || trackingData?.data || trackingData || []
          setVehicleTrackingData(vehicleData)
          return getSortedDriversByDistance(loadingLocation)
        })
        .then((sorted) => {
          setSortedDrivers(sorted)
          const availableWithDistance = sorted.filter(d => d.available === true)
          setAvailableDrivers(availableWithDistance)
        })
        .catch(error => {
          console.error('Error updating driver distances:', error)
        })
    } else {
      setSortedDrivers(drivers)
      setAvailableDrivers(drivers.filter(d => d.available === true))
    }
  }, [loadingLocation])

  // Calculate estimated distance when locations change
  useEffect(() => {
    const calculateRouteDistance = async () => {
      if (!loadingLocation || !dropOffPoint) {
        console.log('Missing locations for distance calc:', { loadingLocation, dropOffPoint })
        setEstimatedDistance(0)
        return
      }
      
      try {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!mapboxToken) {
          console.log('No Mapbox token available')
          return
        }
        
        console.log('Calculating distance between:', loadingLocation, 'and', dropOffPoint)
        
        // First geocode the locations to get coordinates
        const [originResponse, destResponse] = await Promise.all([
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loadingLocation)}.json?access_token=${mapboxToken}&country=za&limit=1`),
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropOffPoint)}.json?access_token=${mapboxToken}&country=za&limit=1`)
        ])
        
        const [originData, destData] = await Promise.all([
          originResponse.json(),
          destResponse.json()
        ])
        
        if (!originData.features?.[0] || !destData.features?.[0]) {
          console.log('Could not geocode locations')
          return
        }
        
        const originCoords = originData.features[0].center
        const destCoords = destData.features[0].center
        
        console.log('Origin coords:', originCoords, 'Dest coords:', destCoords)
        
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}?access_token=${mapboxToken}&geometries=geojson`
        )
        const data = await response.json()
        console.log('Mapbox response:', data)
        
        if (data.routes?.[0]?.distance) {
          const distanceKm = Math.round(data.routes[0].distance / 1000)
          console.log('Distance calculated:', distanceKm, 'km')
          setEstimatedDistance(distanceKm)
        } else {
          console.log('No route found in response')
        }
      } catch (error) {
        console.error('Error calculating distance:', error)
      }
    }
    
    calculateRouteDistance()
  }, [loadingLocation, dropOffPoint])

  // Rate Card Calculation Function
  const calculateRateCardCost = useCallback((vehicleType, kms, days) => {
    if (!vehicleType || !RATE_CARD_SYSTEM[vehicleType]) {
      return {
        fuel_cost: 0,
        base_cost: 0,
        transport_cost: 0,
        extra_stop_cost: 0,
        standing_day_cost: 0,
        profit_amount: 0,
        total_transport: 0,
        ppk_cost: 0
      }
    }

    const rateCard = RATE_CARD_SYSTEM[vehicleType]
    
    // Rate Card Components
    const fuel_cost = rateCard.fuel_rate // Fixed fuel component
    const base_cost = rateCard.base_rate // Fixed base rate
    const ppk_cost = kms * rateCard.ppk  // Per kilometer cost
    const extra_stop_cost = rateCard.extra_stop || 0
    const standing_day_cost = (rateCard.standing_day_cost || 0) * (days > 1 ? days - 1 : 0)
    
    // Transport Cost = Fuel + Base + PPK + Standing Days
    const transport_cost = fuel_cost + base_cost + ppk_cost + standing_day_cost
    
    // Profit Calculation
    const profit_amount = transport_cost * rateCard.profit_margin
    
    // Total Transport = Transport + Profit + Extra Stops
    const total_transport = transport_cost + profit_amount + extra_stop_cost

    return {
      fuel_cost,
      base_cost,
      transport_cost,
      extra_stop_cost,
      standing_day_cost,
      profit_amount,
      total_transport,
      ppk_cost
    }
  }, [RATE_CARD_SYSTEM])

  // Calculate costs when relevant values change
  useEffect(() => {
    if (selectedVehicleType && estimatedDistance > 0) {
      const costBreakdown = calculateRateCardCost(selectedVehicleType, estimatedDistance, tripDays)
      
      setApproximateFuelCost(costBreakdown.fuel_cost)
      setApproximatedVehicleCost(costBreakdown.base_cost + costBreakdown.ppk_cost)
      setApproximatedDriverCost(costBreakdown.standing_day_cost + costBreakdown.extra_stop_cost)
      setTotalVehicleCost(costBreakdown.total_transport)
      
      // CPK = total cost per kilometer
      const cpk = estimatedDistance > 0 ? costBreakdown.total_transport / estimatedDistance : 0
      setApproximatedCPK(cpk)
    } else {
      // Reset values when no vehicle type selected
      setApproximateFuelCost(0)
      setApproximatedVehicleCost(0)
      setApproximatedDriverCost(0)
      setTotalVehicleCost(0)
      setApproximatedCPK(0)
    }
  }, [selectedVehicleType, estimatedDistance, tripDays, calculateRateCardCost])

  // Note: Vehicle and driver costs are now handled by the rate card system
  // Legacy cost calculations removed to prevent conflicts with rate card system

  // Calculate total cost using rate card system
  useEffect(() => {
    if (selectedVehicleType && estimatedDistance > 0) {
      const costBreakdown = calculateRateCardCost(selectedVehicleType, estimatedDistance, tripDays)
      const total = costBreakdown.total_transport + (parseFloat(goodsInTransitPremium) || 0)
      setTotalVehicleCost(total)
    } else {
      const total = approximateFuelCost + approximatedVehicleCost + approximatedDriverCost + (parseFloat(goodsInTransitPremium) || 0)
      setTotalVehicleCost(total)
    }
  }, [selectedVehicleType, estimatedDistance, tripDays, approximateFuelCost, approximatedVehicleCost, approximatedDriverCost, goodsInTransitPremium, calculateRateCardCost])

  // Calculate distance from point to route line
  const distanceToRoute = useCallback((pointLat, pointLng, routeCoords) => {
    if (!routeCoords || routeCoords.length < 2) return Infinity
    
    let minDistance = Infinity
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [lng1, lat1] = routeCoords[i]
      const [lng2, lat2] = routeCoords[i + 1]
      
      // Distance from point to line segment
      const A = pointLat - lat1
      const B = pointLng - lng1
      const C = lat2 - lat1
      const D = lng2 - lng1
      
      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let param = -1
      if (lenSq !== 0) param = dot / lenSq
      
      let xx, yy
      if (param < 0) {
        xx = lat1
        yy = lng1
      } else if (param > 1) {
        xx = lat2
        yy = lng2
      } else {
        xx = lat1 + param * C
        yy = lng1 + param * D
      }
      
      const distance = calculateDistance(pointLat, pointLng, xx, yy)
      minDistance = Math.min(minDistance, distance)
    }
    return minDistance
  }, [calculateDistance])

  // Filter stop points within 25km of route and between origin/destination
  const filteredStopPoints = useMemo(() => {
    if (!loadingLocation || !dropOffPoint || !optimizedRoute?.route?.geometry?.coordinates) {
      return availableStopPoints
    }
    
    const routeCoords = optimizedRoute.route.geometry.coordinates
    const [originLng, originLat] = routeCoords[0]
    const [destLng, destLat] = routeCoords[routeCoords.length - 1]
    
    return availableStopPoints.filter(point => {
      if (!point.coordinates) return false
      
      try {
        const coordPairs = point.coordinates.split(' ')
          .filter(coord => coord.trim())
          .map(coord => {
            const [lng, lat] = coord.split(',')
            return [parseFloat(lng), parseFloat(lat)]
          })
          .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]))
        
        if (coordPairs.length === 0) return false
        
        // Use centroid of stop point polygon
        const avgLng = coordPairs.reduce((sum, coord) => sum + coord[0], 0) / coordPairs.length
        const avgLat = coordPairs.reduce((sum, coord) => sum + coord[1], 0) / coordPairs.length
        
        // Check if within 25km of route
        const distance = distanceToRoute(avgLat, avgLng, routeCoords)
        if (distance > 25) return false
        
        // Check if between origin and destination
        const distToOrigin = calculateDistance(avgLat, avgLng, originLat, originLng)
        const distToDest = calculateDistance(avgLat, avgLng, destLat, destLng)
        const originToDestDist = calculateDistance(originLat, originLng, destLat, destLng)
        
        // Point is between origin and destination if sum of distances is roughly equal to direct distance
        return (distToOrigin + distToDest) <= (originToDestDist * 1.2) // 20% tolerance
      } catch (error) {
        return false
      }
    })
  }, [availableStopPoints, loadingLocation, dropOffPoint, optimizedRoute, distanceToRoute, calculateDistance])

  // Get selected stop points with coordinates including custom locations
  const getSelectedStopPointsData = useCallback(async () => {
    console.log('getSelectedStopPointsData called with:', { stopPoints, customStopPoints, availableStopPoints: availableStopPoints.length })
    
    // Ensure stop points are loaded if not already available
    if (availableStopPoints.length === 0 && (stopPoints.length > 0 || customStopPoints.some(p => p))) {
      console.log('Loading stop points from database...')
      try {
        const { data: stopPointsData, error: stopPointsError } = await supabase
          .from('stop_points')
          .select('id, name, name2, coordinates')
          .order('name')
        
        if (stopPointsError) {
          console.error('Stop points error:', stopPointsError)
        } else {
          setAvailableStopPoints(stopPointsData || [])
          console.log('Loaded stop points:', stopPointsData?.length || 0)
        }
      } catch (err) {
        console.error('Error fetching stop points:', err)
      }
    }
    
    const results = []
    
    for (let i = 0; i < stopPoints.length; i++) {
      const pointId = stopPoints[i]
      const customLocation = customStopPoints[i]
      console.log(`Processing stop point ${i}:`, { pointId, customLocation })
      
      if (customLocation) {
        // Geocode custom location
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(customLocation)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&country=za&limit=1`
          )
          const data = await response.json()
          if (data.features?.[0]) {
            const [lng, lat] = data.features[0].center
            results.push({
              id: `custom_${i}`,
              name: customLocation,
              coordinates: [[lng, lat]]
            })
          }
        } catch (error) {
          console.error('Error geocoding custom location:', error)
        }
      } else if (pointId) {
        // Use existing stop point - use current availableStopPoints or fetch directly
        let point = availableStopPoints.find(p => p.id.toString() === pointId)
        
        // If not found in current array, fetch directly from database
        if (!point) {
          console.log('Stop point not found in cache, fetching from database...')
          try {
            const { data: pointData, error } = await supabase
              .from('stop_points')
              .select('id, name, name2, coordinates')
              .eq('id', pointId)
              .single()
            
            if (!error && pointData) {
              point = pointData
              console.log('Fetched stop point from database:', point)
            }
          } catch (err) {
            console.error('Error fetching individual stop point:', err)
          }
        }
        
        console.log('Found stop point for ID', pointId, ':', point)
        if (point?.coordinates) {
          try {
            const coordPairs = point.coordinates.split(' ')
              .filter(coord => coord.trim())
              .map(coord => {
                const [lng, lat] = coord.split(',')
                return [parseFloat(lng), parseFloat(lat)]
              })
              .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]))
            
            console.log('Parsed coordinates:', coordPairs)
            results.push({
              id: point.id,
              name: point.name,
              coordinates: coordPairs
            })
          } catch (error) {
            console.error('Error parsing coordinates:', error)
          }
        } else {
          console.log('No coordinates found for point:', pointId)
          console.log('Point found but no coordinates:', point)
        }
      }
    }
    
    console.log('getSelectedStopPointsData returning:', results)
    return results
  }, [stopPoints, customStopPoints, availableStopPoints])

  // Optimized handlers with useCallback
  const handleDriverChange = useCallback((driverIndex, driverId) => {
    const selectedDriver = drivers.find(d => d.id === driverId)
    setDriverAssignments(prev => {
      const updated = [...prev]
      updated[driverIndex] = { 
        id: driverId, 
        name: selectedDriver?.surname || '',
        first_name: selectedDriver?.first_name || '',
        surname: selectedDriver?.surname || ''
      }
      return updated
    })
    
    // Show driver location on map
    if (selectedDriver) {
      const driverFullName = `${selectedDriver.first_name} ${selectedDriver.surname}`.trim().toLowerCase()
      const trackingData = Array.isArray(vehicleTrackingData) ? vehicleTrackingData : []
      const matchingVehicle = trackingData.find(vehicle => 
        vehicle.driver_name && 
        vehicle.driver_name.toLowerCase() === driverFullName
      )
      
      if (matchingVehicle?.latitude && matchingVehicle?.longitude) {
        setSelectedDriverLocation({
          driver: selectedDriver,
          vehicle: matchingVehicle,
          latitude: parseFloat(matchingVehicle.latitude),
          longitude: parseFloat(matchingVehicle.longitude)
        })
        // Force route recalculation when driver changes
        setOptimizedRoute(null)
      } else {
        setSelectedDriverLocation(null)
      }
    } else {
      setSelectedDriverLocation(null)
    }
  }, [drivers, vehicleTrackingData])

  const addDriver = useCallback(() => {
    setDriverAssignments(prev => [...prev, { id: '', name: '' }])
  }, [])

  // Auto-select closest driver when dropdown is opened
  const handleDriverDropdownOpen = useCallback(async (driverIndex) => {
    if (!loadingLocation) return
    
    setIsCalculatingDistance(true)
    try {
      // Refresh vehicle tracking data first
      const trackingResponse = await fetch('http://64.227.138.235:3000/api/eps-vehicles')
      const trackingData = await trackingResponse.json()
      const vehicleData = trackingData?.result?.data || trackingData?.data || trackingData || []
      setVehicleTrackingData(vehicleData)
      
      const sorted = await getSortedDriversByDistance(loadingLocation)
      setSortedDrivers(sorted)
      
      // Auto-select closest driver if available
      const closestDriver = sorted.find(d => d.distance !== null)
      if (closestDriver) {
        handleDriverChange(driverIndex, closestDriver.id)
      }
    } catch (error) {
      console.error('Error calculating driver distances:', error)
    }
    setIsCalculatingDistance(false)
  }, [loadingLocation, getSortedDriversByDistance, handleDriverChange])

  // Helper to get assigned vehicles/drivers display
  const getAssignmentsDisplay = (load) => {
    const assignments = load.vehicleAssignments || load.vehicle_assignments || []
    if (!assignments.length) return 'Unassigned'
    
    return assignments.map(assignment => {
      const vehicleName = assignment.vehicle?.name || 'Unknown Vehicle'
      const driverNames = assignment.drivers?.map(d => d.name).filter(Boolean).join(', ') || 'No Driver'
      return `${vehicleName} (${driverNames})`
    }).join('; ')
  }

  // Parse JSON fields safely
  const parseJsonField = (field) => {
    if (!field) return []
    if (Array.isArray(field)) return field
    try {
      return JSON.parse(field)
    } catch {
      return []
    }
  }

  const [summaryOpen, setSummaryOpen] = useState(false)
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null)
  // Routing assigned items
  const [assignedItems, setAssignedItems] = useState<any[]>([])
  // Left items available to assign
  const [leftItems, setLeftItems] = useState<any[]>([
    { id: 'a', title: 'VINCEMUS INVESTMENTS (P...)', addr: 'Johannesburg, South Africa', addr2: 'Estcourt, 3310, South Africa' },
    { id: 'b', title: 'TRADELANDER 5 CC', addr: 'Randfontein, South Africa' }
  ])

  const handleCreateClick = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!client || !commodity || !loadingLocation || !dropOffPoint) {
      showToast('Please fill out all required fields', 'error')
      return
    }
    
    handleCreateOrUpdate()
  }

  const handleClientSelect = async (clientData) => {
    if (typeof clientData === 'object' && clientData.address) {
      setSelectedClient(clientData)
      setClient(clientData.name)
      setManualClientName('') // Clear manual input
      
      // Always geocode client address as an additional option
      if (clientData.address) {
        try {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          if (mapboxToken) {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(clientData.address)}.json?access_token=${mapboxToken}&country=za&limit=1`
            )
            const data = await response.json()
            if (data.features?.[0]) {
              const [lng, lat] = data.features[0].center
              const geocodedClient = {
                ...clientData,
                geocoded_coordinates: `${lng},${lat}`,
                geocoded_address: data.features[0].place_name
              }
              setSelectedClient(geocodedClient)
              console.log(`✓ Geocoded client address: ${clientData.address} -> ${lng},${lat}`)
            }
          }
        } catch (error) {
          console.error('Error geocoding client address:', error)
        }
      }
      
      setShowAddressPopup(true)
    } else if (typeof clientData === 'object' && clientData.coordinates) {
      setSelectedClient(clientData)
      setClient(clientData.name)
      setManualClientName('') // Clear manual input
      setShowAddressPopup(true)
    } else {
      setClient(typeof clientData === 'string' ? clientData : clientData?.name || '')
      setSelectedClient(clientData)
      setManualClientName('') // Clear manual input
    }
  }

  const handleUseAsPickup = () => {
    // Use stored coordinates first, fallback to geocoded address if no coordinates
    if (selectedClient?.coordinates) {
      try {
        const coords = selectedClient.coordinates.split(' ')[0].split(',')
        if (coords.length >= 2) {
          const lng = parseFloat(coords[0])
          const lat = parseFloat(coords[1])
          if (!isNaN(lng) && !isNaN(lat)) {
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`)
              .then(response => response.json())
              .then(data => {
                if (data.features && data.features.length > 0) {
                  setLoadingLocation(data.features[0].place_name)
                } else {
                  setLoadingLocation(`${lat},${lng}`)
                }
              })
              .catch(() => setLoadingLocation(`${lat},${lng}`))
          }
        }
      } catch (error) {
        console.error('Error parsing coordinates:', error)
      }
    } else if (selectedClient?.geocoded_address) {
      setLoadingLocation(selectedClient.geocoded_address)
    }
    setShowAddressPopup(false)
  }

  const handleUseAsDropoff = () => {
    // Use stored coordinates first, fallback to geocoded address if no coordinates
    if (selectedClient?.coordinates) {
      try {
        const coords = selectedClient.coordinates.split(' ')[0].split(',')
        if (coords.length >= 2) {
          const lng = parseFloat(coords[0])
          const lat = parseFloat(coords[1])
          if (!isNaN(lng) && !isNaN(lat)) {
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`)
              .then(response => response.json())
              .then(data => {
                if (data.features && data.features.length > 0) {
                  setDropOffPoint(data.features[0].place_name)
                } else {
                  setDropOffPoint(`${lat},${lng}`)
                }
              })
              .catch(() => setDropOffPoint(`${lat},${lng}`))
          }
        }
      } catch (error) {
        console.error('Error parsing coordinates:', error)
      }
    } else if (selectedClient?.geocoded_address) {
      setDropOffPoint(selectedClient.geocoded_address)
    }
    setShowAddressPopup(false)
  }

  const handleSkipAddress = () => {
    setShowAddressPopup(false)
  }



  const handleCreateOrUpdate = async () => {
    if (isEditMode) {
      return handleUpdate()
    }
    return handleCreate()
  }
  
  const handleUpdate = async () => {
    try {
      const tripData = {
        ordernumber: orderNumber,
        rate: rate,
        cargo: commodity,
        origin: loadingLocation,
        destination: dropOffPoint,
        notes: comment,
        
        clientdetails: selectedClient ? {
          name: selectedClient.name,
          email: selectedClient.email || '',
          phone: selectedClient.phone || '',
          address: selectedClient.address || '',
          contactPerson: selectedClient.contact_person || '',
          client_id: selectedClient.client_id || '',
          vat_number: selectedClient.vat_number || ''
        } : {
          name: client,
          email: '',
          phone: '',
          address: '',
          contactPerson: ''
        },
        
        pickuplocations: [{
          location: loadingLocation || '',
          address: loadingLocation || '',
          scheduled_time: etaPickup || ''
        }],
        
        dropofflocations: [{
          location: dropOffPoint || '',
          address: dropOffPoint || '',
          scheduled_time: etaDropoff || ''
        }],
        
        vehicleassignments: [{
          drivers: driverAssignments,
          vehicle: { 
            id: selectedVehicleId, 
            name: selectedVehicleId ? vehicles.find(v => v.id.toString() === selectedVehicleId)?.registration_number || '' : ''
          },
          trailer: {
            id: selectedTrailerId,
            name: selectedTrailerId ? vehicles.find(v => v.id.toString() === selectedTrailerId)?.registration_number || '' : ''
          }
        }],
        
        trip_type: tripType,
        selected_stop_points: stopPoints,
        selected_vehicle_type: selectedVehicleType,
        updated_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('trips')
        .update(tripData)
        .eq('id', editTripId)
      
      if (error) throw error
      
      showToast('Trip updated successfully!', 'success')
      
      // Clear sessionStorage and redirect
      sessionStorage.removeItem('editTripData')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
      
    } catch (err) {
      console.error('Error updating trip:', err)
      showToast('Failed to update trip', 'error')
    }
  }
  
  const handleCreate = async () => {
    try {
      // Save route to database for both trip types when creating the load
      let routeId = null
      if (loadingLocation && dropOffPoint) {
        try {
          const selectedStopPoints = await getSelectedStopPointsData()
          const waypoints = selectedStopPoints.map(point => {
            const coords = point.coordinates
            const avgLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length
            const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length
            return `${avgLng},${avgLat}`
          })
          
          const routeResponse = await fetch('/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: loadingLocation,
              destination: dropOffPoint,
              orderId: orderNumber,
              pickupTime: etaPickup,
              waypoints: waypoints
            })
          })
          
          if (routeResponse.ok) {
            const routeData = await routeResponse.json()
            routeId = routeData.route?.id
          }
        } catch (routeError) {
          console.error('Error saving route:', routeError)
          // Continue with load creation even if route saving fails
        }
      }
      
      const tripData = {
        trip_id: `LOAD-${Date.now()}`,
        ordernumber: orderNumber,
        rate: rate,
        cargo: commodity,
        origin: loadingLocation,
        destination: dropOffPoint,
        notes: comment,
        status: 'pending',
        startdate: etaPickup ? etaPickup.split('T')[0] : null,
        enddate: etaDropoff ? etaDropoff.split('T')[0] : null,
        route: routeId ? routeId.toString() : null, // Link to saved route

        clientdetails: selectedClient ? {
          name: selectedClient.name,
          email: '',
          phone: selectedClient.phone || '',
          address: selectedClient.address || '',
          contactPerson: selectedClient.contact_person || '',
          client_id: selectedClient.client_id || '',
          vat_number: selectedClient.vat_number || ''
        } : {
          name: client,
          email: '',
          phone: '',
          address: '',
          contactPerson: ''
        },
        pickuplocations: [{
          location: loadingLocation || '',
          address: loadingLocation || '',
          scheduled_time: etaPickup || ''
        }],
        dropofflocations: [{
          location: dropOffPoint || '',
          address: dropOffPoint || '',
          scheduled_time: etaDropoff || ''
        }],
        vehicleassignments: [{
          drivers: driverAssignments,
          vehicle: { 
            id: selectedVehicleId, 
            name: selectedVehicleId ? vehicles.find(v => v.id.toString() === selectedVehicleId)?.registration_number || '' : ''
          },
          trailer: {
            id: selectedTrailerId,
            name: selectedTrailerId ? vehicles.find(v => v.id.toString() === selectedTrailerId)?.registration_number || '' : ''
          }
        }],
        trip_type: tripType,
        selected_stop_points: stopPoints.map((pointId, index) => {
          if (customStopPoints[index]) {
            return { type: 'custom', name: customStopPoints[index], id: `custom_${index}` }
          } else if (pointId) {
            const point = availableStopPoints.find(p => p.id.toString() === pointId)
            return point ? { type: 'existing', ...point } : null
          }
          return null
        }).filter(Boolean),
        selected_vehicle_type: selectedVehicleType,
        approximate_fuel_cost: approximateFuelCost,
        approximated_cpk: approximatedCPK,
        approximated_vehicle_cost: approximatedVehicleCost,
        approximated_driver_cost: approximatedDriverCost,
        total_vehicle_cost: totalVehicleCost,
        goods_in_transit_premium: parseFloat(goodsInTransitPremium) || null,
        estimated_distance: estimatedDistance,
        fuel_price_per_liter: parseFloat(fuelPricePerLiter) || null
      }
      
      console.log('Inserting trip data:', tripData)
      const { data, error } = await supabase.from('trips').insert([tripData])
      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(`Database error: ${error.message || 'Unknown error'}`)
      }
      console.log('Trip created successfully:', data)
      
      // Mark assigned drivers as unavailable
      const assignedDriverIds = driverAssignments
        .map(d => d.id)
        .filter(id => id)
      
      if (assignedDriverIds.length > 0) {
        try {
          await markDriversUnavailable(assignedDriverIds)
          showToast(`${assignedDriverIds.length} driver(s) marked as unavailable`, 'success')
        } catch (error) {
          console.error('Error updating driver availability:', error)
          showToast('Load created successfully, but failed to update driver availability', 'warning')
        }
      }
      
      // Reset form
      setClient(''); setSelectedClient(null); setManualClientName(''); setCommodity(''); setRate(''); setOrderNumber(''); setComment('')
      setEtaPickup(''); setLoadingLocation(''); setEtaDropoff(''); setDropOffPoint('')
      setDriverAssignments([{ id: '', name: '' }])
      setSelectedVehicleId('')
      setSelectedTrailerId('')
      setTripType('local')
      setStopPoints([]) // Reset stop points for both trip types
      setCustomStopPoints([])
      setFuelPricePerLiter('')
      setGoodsInTransitPremium('')
      setSelectedVehicleType('')
      setShowSecondSection(false)
      setOptimizedRoute(null)
      
      // Refresh data
      fetchData()
      
      showToast('Load created successfully!', 'success')
    } catch (err) {
      console.error('Error creating load:', err)
      showToast('Something went wrong while creating the load', 'error')
    }
  }

  return (
    <div className="p-6 space-y-6 w-full">
      <h1 className="text-2xl font-bold mb-6">Load Plan</h1>
      
      <Tabs defaultValue="loads" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="loads">Loads</TabsTrigger>
          <TabsTrigger value="create">Create Load</TabsTrigger>
        </TabsList>

        <TabsContent value="loads" className="space-y-6">
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><Route className="h-8 w-8 text-blue-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Total Loads</p>
                <p className="text-xl font-semibold">{loads.length}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><CheckCircle className="h-8 w-8 text-green-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-xl font-semibold">{loads.filter(l => l.status === 'completed').length}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><Clock className="h-8 w-8 text-yellow-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-semibold">{loads.filter(l => l.status === 'pending').length}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><TrendingUp className="h-8 w-8 text-blue-500" /></div>
              <div>
                <p className="text-sm text-gray-500">In Transit</p>
                <p className="text-xl font-semibold">{loads.filter(l => l.status === 'in-transit').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm">
            <div className="p-4">

              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-100">
                    <TableHead>Client</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead>Drop Off</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No trips available. Total loads: {loads.length}
                      </TableCell>
                    </TableRow>
                  ) : loads.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/50">
                      <TableCell>{row.client}</TableCell>
                      <TableCell>{row.commodity}</TableCell>
                      <TableCell>{row.rate}</TableCell>
                      <TableCell>
                        {row.etaPickup ? (
                          row.etaPickup.includes('T') ? new Date(row.etaPickup).toLocaleString() : row.etaPickup
                        ) : (row.startdate || '-')}
                      </TableCell>
                      <TableCell>
                        {row.etaDropoff ? (
                          row.etaDropoff.includes('T') ? new Date(row.etaDropoff).toLocaleString() : row.etaDropoff
                        ) : (row.enddate || '-')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {(() => {
                          const assignments = parseJsonField(row.vehicleassignments) || []
                          if (!assignments.length) return 'Unassigned'
                          return assignments.map(assignment => {
                            const vehicleName = assignment.vehicle?.name || 'Unknown Vehicle'
                            const driverNames = assignment.drivers?.map(d => d.name).filter(Boolean).join(', ') || 'No Driver'
                            return `${vehicleName} (${driverNames})`
                          }).join('; ')
                        })()
                        }
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          row.status === "completed" ? "bg-green-100 text-green-800" :
                          row.status === "in-transit" ? "bg-blue-100 text-blue-800" :
                          row.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        )}>
                          {row.status || 'pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4" />
                          Summary
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <div className="space-y-6">
            <Card>
            <CardHeader>
              <CardTitle>Create New Load</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-6">
                {/* Basic Load Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="clientCode">Client Code</Label>
                      <ClientDropdown 
                        value={selectedClient ? client : ''} 
                        onChange={handleClientSelect} 
                        clients={clients}
                        placeholder="Select client code" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="commodity">Commodity</Label>
                      <CommodityDropdown value={commodity} onChange={setCommodity} placeholder="Select commodity" />
                    </div>
                    <div>
                      <Label htmlFor="orderNumber">Order Number</Label>
                      <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Order Number" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="client">Client</Label>
                    <div className="space-y-2">
                      <ClientNameDisplay 
                        selectedClient={selectedClient}
                        placeholder="Client name will appear here"
                      />
                      <div className="text-center text-xs text-gray-500">OR</div>
                      <Input 
                        value={manualClientName}
                        onChange={(e) => {
                          setManualClientName(e.target.value)
                          setClient(e.target.value)
                          setSelectedClient(null)
                        }}
                        placeholder="Type new client name"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="comment">Comment</Label>
                    <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" />
                  </div>
                </div>

                {/* Location & Timing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="etaPickup">ETA Pick Up</Label>
                    <DateTimePicker
                      value={etaPickup}
                      onChange={setEtaPickup}
                      placeholder="Select pickup date and time"
                    />
                  </div>
                  <div>
                    <LocationAutocomplete
                      label="Loading Location"
                      value={loadingLocation}
                      onChange={(value) => {
                        console.log('Loading location changed to:', value)
                        setLoadingLocation(value)
                        setOptimizedRoute(null) // Force route recalculation
                      }}
                      placeholder="Search for loading location"
                      clientLocations={useMemo(() => {
                        const selectedClient = clients.find(c => c.name === client)
                        if (!selectedClient) return []
                        try {
                          return typeof selectedClient.pickupLocations === 'string' ? 
                            JSON.parse(selectedClient.pickupLocations) : 
                            (selectedClient.pickupLocations || selectedClient.pickup_locations || [])
                        } catch { return [] }
                      }, [clients, client])
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="etaDropoff">ETA Drop Off</Label>
                    <DateTimePicker
                      value={etaDropoff}
                      onChange={setEtaDropoff}
                      placeholder="Select drop-off date and time"
                    />
                  </div>
                  <div>
                    <LocationAutocomplete
                      label="Drop Off Point"
                      value={dropOffPoint}
                      onChange={(value) => {
                        console.log('Drop off location changed to:', value)
                        setDropOffPoint(value)
                        setOptimizedRoute(null) // Force route recalculation
                      }}
                      placeholder="Search for drop off location"
                      clientLocations={useMemo(() => {
                        const selectedClient = clients.find(c => c.name === client)
                        if (!selectedClient) return []
                        try {
                          return typeof selectedClient.dropoffLocations === 'string' ? 
                            JSON.parse(selectedClient.dropoffLocations) : 
                            (selectedClient.dropoffLocations || selectedClient.dropoff_locations || [])
                        } catch { return [] }
                      }, [clients, client])
                      }
                    />
                  </div>
                </div>

                {/* Trip Type Selection */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Trip Type</Label>
                  <div className="flex space-x-6">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="local" 
                        name="tripType" 
                        value="local" 
                        checked={tripType === 'local'}
                        onChange={(e) => setTripType(e.target.value)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="local">Local Trip</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="national" 
                        name="tripType" 
                        value="national" 
                        checked={tripType === 'national'}
                        onChange={(e) => {
                          setTripType(e.target.value)
                          fetchStopPoints() // Load stop points for both trip types
                        }}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="national">Long Distance</Label>
                    </div>
                  </div>
                </div>

                {/* Stop Points - Available for both Local and Long Distance */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-lg font-medium">Stop Points</Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Add stops from existing points or search for custom locations
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        await fetchStopPoints()
                        setStopPoints([...stopPoints, ''])
                      }} 
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Stop Point
                    </Button>
                  </div>
                  
                  {stopPoints.map((stopPoint, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <StopPointDropdown
                            value={stopPoint}
                            onChange={(value) => {
                              console.log('StopPointDropdown onChange called with value:', value)
                              const updated = [...stopPoints]
                              updated[index] = value
                              console.log('Setting stopPoints from:', stopPoints, 'to:', updated)
                              setStopPoints(updated)
                              const updatedCustom = [...customStopPoints]
                              updatedCustom[index] = ''
                              setCustomStopPoints(updatedCustom)
                              // Force route recalculation
                              setOptimizedRoute(null)
                            }}
                            stopPoints={filteredStopPoints}
                            placeholder="Select from existing stop points"
                            isLoading={isLoadingStopPoints}
                          />
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const updated = stopPoints.filter((_, i) => i !== index)
                            setStopPoints(updated)
                            const updatedCustom = customStopPoints.filter((_, i) => i !== index)
                            setCustomStopPoints(updatedCustom)
                            setIsManuallyOrdered(false)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-center text-xs text-gray-500">OR</div>
                      <LocationAutocomplete
                        label=""
                        value={customStopPoints[index] || ''}
                        onChange={(value) => {
                          console.log('Custom stop point changed:', value)
                          const updatedCustom = [...customStopPoints]
                          while (updatedCustom.length <= index) {
                            updatedCustom.push('')
                          }
                          updatedCustom[index] = value
                          setCustomStopPoints(updatedCustom)
                          if (value) {
                            const updated = [...stopPoints]
                            updated[index] = ''
                            setStopPoints(updated)
                          }
                          // Force route recalculation
                          setOptimizedRoute(null)
                        }}
                        placeholder="Search for custom stop location"
                      />
                    </div>
                  ))}
                </div>

                {/* Route Preview */}
                {(loadingLocation && dropOffPoint) || selectedClient?.coordinates ? (
                  <div className="col-span-full">
                    <div className="space-y-4">
                      {isOptimizing && tripType === 'national' && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          Optimizing route...
                        </div>
                      )}
                      <div className="space-y-4">
                        <RoutePreviewMap
                          key={`${loadingLocation}-${dropOffPoint}-${stopPoints.join(',')}-${customStopPoints.join(',')}`}
                          origin={loadingLocation}
                          destination={dropOffPoint}
                          routeData={optimizedRoute}
                          stopPoints={stopPoints.length > 0 || customStopPoints.some(p => p) ? 'async' : []}
                          getStopPointsData={getSelectedStopPointsData}
                          preserveOrder={isManuallyOrdered}
                          driverLocation={selectedDriverLocation ? {
                            lat: selectedDriverLocation.latitude,
                            lng: selectedDriverLocation.longitude,
                            name: `${selectedDriverLocation.driver.first_name} ${selectedDriverLocation.driver.surname}`
                          } : undefined}
                          clientLocation={selectedClient?.coordinates ? (() => {
                            try {
                              const coords = selectedClient.coordinates.split(' ')[0].split(',')
                              if (coords.length >= 2) {
                                const lng = parseFloat(coords[0])
                                const lat = parseFloat(coords[1])
                                if (!isNaN(lng) && !isNaN(lat)) {
                                  return { lat, lng, name: selectedClient.name }
                                }
                              }
                            } catch (error) {
                              console.error('Error parsing client coordinates:', error)
                            }
                            return undefined
                          })() : undefined}
                          selectedClient={selectedClient}
                        />
                        
                        {/* Route Summary */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">
                              {tripType === 'local' ? 'Local Route' : 'Long Distance Route'} (Optimized)
                            </h4>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowRouteModal(true)}
                            >
                              Edit Route
                            </Button>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Loading:</span> {loadingLocation}
                            </div>
                            {stopPoints.length > 0 && (
                              <div>
                                <span className="font-medium">Stop Points:</span> {stopPoints.length} stop(s) added
                              </div>
                            )}
                            {dropOffPoint && (
                              <div>
                                <span className="font-medium">Drop-off:</span> {dropOffPoint}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Trip Type:</span> {tripType === 'local' ? 'Local Trip' : 'Long Distance'}
                            </div>
                            <div>
                              <span className="font-medium">Driver:</span> {
                                (() => {
                                  const firstDriver = driverAssignments[0]
                                  if (firstDriver?.id) {
                                    const driver = drivers.find(d => d.id === firstDriver.id)
                                    return driver ? `${driver.first_name} ${driver.surname}` : 'Selected Driver'
                                  }
                                  return 'No driver selected'
                                })()
                              }
                            </div>
                            {optimizedRoute && (
                              <div className="border-t pt-2 mt-2">
                                <div className="font-medium text-blue-600 mb-1">
                                  Route Information {optimizedRoute.hasDriverLocation ? '(Driver → Loading → Drop-off)' : '(Loading → Drop-off)'}:
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="font-medium">Total Distance:</span> {
                                      Math.round((optimizedRoute.route?.distance || optimizedRoute.distance) / 1000 * 10) / 10
                                    } km
                                  </div>
                                  <div>
                                    <span className="font-medium">Estimated Time:</span> {
                                      (() => {
                                        const duration = optimizedRoute.route?.duration || optimizedRoute.duration
                                        return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
                                      })()
                                    }
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Driver Assignments */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-medium">Driver Assignments</Label>
                    <Button 
                      type="button" 
                      onClick={addDriver} 
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Driver
                    </Button>
                  </div>
                  
                  {driverAssignments.map((driver, driverIndex) => (
                    <div key={driverIndex} className="mb-2">
                      <DriverDropdown
                        value={driver.id}
                        onChange={(value) => handleDriverChange(driverIndex, value)}
                        onOpen={() => handleDriverDropdownOpen(driverIndex)}
                        drivers={availableDrivers}
                        placeholder="Select available driver"
                        showDistance={!!loadingLocation}
                      />
                    </div>
                  ))}
                </div>

                {/* Vehicle Selection */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Vehicle Assignment</Label>
                  
                  {/* Vehicle Type Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType" className="text-sm font-medium text-slate-700">Vehicle Type</Label>
                    <VehicleTypeDropdown
                      value={selectedVehicleType}
                      onChange={(value) => {
                        setSelectedVehicleType(value)
                        setSelectedVehicleId('') // Reset vehicle selection when type changes
                      }}
                      placeholder="Select vehicle type"
                    />
                  </div>

                  {/* Horse Dropdown - Vehicles only */}
                  <div className="space-y-2">
                    <Label htmlFor="horse" className="text-sm font-medium text-slate-700">Select Horse</Label>
                    <VehicleDropdown
                      value={selectedVehicleId}
                      onChange={setSelectedVehicleId}
                      vehicles={vehicles.filter(vehicle => vehicle.vehicle_type === 'vehicle')}
                      placeholder="Select horse (vehicle)"
                    />
                  </div>

                  {/* Trailer Dropdown - All except vehicles */}
                  <div className="space-y-2">
                    <Label htmlFor="trailer" className="text-sm font-medium text-slate-700">Select Trailer</Label>
                    <TrailerDropdown
                      value={selectedTrailerId}
                      onChange={setSelectedTrailerId}
                      trailers={vehicles.filter(vehicle => vehicle.vehicle_type !== 'vehicle')}
                      placeholder="Select trailer"
                    />
                  </div>
                </div>



                {/* Cost Calculation Section */}
                <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-600 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Trip Cost Estimation</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Left Half - Input Fields and Stats */}
                    <div className="h-full flex flex-col justify-between space-y-6">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="fuelPrice" className="text-sm font-medium text-slate-700">Fuel Price per Liter</Label>
                            <Input 
                              value={fuelPricePerLiter} 
                              onChange={(e) => setFuelPricePerLiter(e.target.value)} 
                              placeholder="R 20.50" 
                              type="number"
                              step="0.01"
                              className="border-slate-300 focus:border-slate-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rate" className="text-sm font-medium text-slate-700">Rate</Label>
                            <Input 
                              value={rate} 
                              onChange={(e) => setRate(e.target.value)} 
                              placeholder="R 0.00" 
                              type="number"
                              step="0.01"
                              className="border-slate-300 focus:border-slate-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tripDays" className="text-sm font-medium text-slate-700">Trip Days</Label>
                            <Input 
                              value={tripDays} 
                              onChange={(e) => setTripDays(parseFloat(e.target.value) || 1)} 
                              placeholder="1" 
                              type="number"
                              step="0.5"
                              min="0.5"
                              className="border-slate-300 focus:border-slate-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="goodsInTransit" className="text-sm font-medium text-slate-700">Goods In Transit Premium</Label>
                            <Input 
                              value={goodsInTransitPremium} 
                              onChange={(e) => setGoodsInTransitPremium(e.target.value)} 
                              placeholder="R 0.00" 
                              type="number"
                              step="0.01"
                              className="border-slate-300 focus:border-slate-500"
                            />
                          </div>
                        </div>

                        {/* Cost Display Cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Distance</p>
                            <p className="text-2xl font-bold text-slate-800 mt-2">{estimatedDistance}</p>
                            <p className="text-xs text-slate-600">kilometers</p>
                          </div>
                          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">CPK</p>
                            <p className="text-2xl font-bold text-slate-800 mt-2">R{approximatedCPK.toFixed(2)}</p>
                            <p className="text-xs text-slate-600">per km</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Total Cost - Bottom Aligned */}
                      <div className="p-6 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl shadow-lg">
                        <p className="text-sm font-medium text-slate-200 uppercase tracking-wide">Total Estimated Cost</p>
                        <p className="text-3xl font-bold text-white mt-2">R{totalVehicleCost.toLocaleString()}</p>
                        <p className="text-sm text-slate-300 mt-1">All expenses included</p>
                      </div>
                    </div>

                    {/* Right Half - Stylish Bar Chart */}
                    <div className="h-full flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                          <TrendingUp className="h-4 w-4 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Cost Breakdown</h4>
                      </div>
                      <div className="flex-1 w-full p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-lg">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Fuel', value: approximateFuelCost, fill: 'url(#fuelGradient)' },
                              { name: 'Vehicle', value: approximatedVehicleCost, fill: 'url(#vehicleGradient)' },
                              { name: 'Driver', value: approximatedDriverCost, fill: 'url(#driverGradient)' },
                              ...(parseFloat(goodsInTransitPremium) > 0 ? [{ name: 'Premium', value: parseFloat(goodsInTransitPremium), fill: 'url(#premiumGradient)' }] : [])
                            ]}
                            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                          >
                            <defs>
                              <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9}/>
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="vehicleGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#34d399" stopOpacity={0.9}/>
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="driverGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9}/>
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7}/>
                              </linearGradient>
                              <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9}/>
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid 
                              strokeDasharray="2 4" 
                              stroke="#e2e8f0" 
                              strokeOpacity={0.6}
                              vertical={false}
                            />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                              axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                              tickLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                              axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                              tickLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(value) => `R${value.toLocaleString()}`}
                            />
                            <Tooltip 
                              formatter={(value, name) => [
                                `R${value.toLocaleString()}`, 
                                `${name} Cost`
                              ]}
                              labelStyle={{ 
                                color: '#1e293b', 
                                fontWeight: 600,
                                fontSize: '14px'
                              }}
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                border: 'none',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                backdropFilter: 'blur(10px)'
                              }}
                              cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                            />
                            <Bar 
                              dataKey="value" 
                              radius={[8, 8, 0, 0]}
                              strokeWidth={2}
                              stroke="rgba(255, 255, 255, 0.3)"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 justify-center">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-200">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
                          <span className="text-xs font-medium text-blue-700">Fuel</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-b from-green-400 to-green-600"></div>
                          <span className="text-xs font-medium text-green-700">Vehicle</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-200">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>
                          <span className="text-xs font-medium text-yellow-700">Driver</span>
                        </div>
                        {parseFloat(goodsInTransitPremium) > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full border border-purple-200">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-b from-purple-400 to-purple-600"></div>
                            <span className="text-xs font-medium text-purple-700">Premium</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isEditMode && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        sessionStorage.removeItem('editTripData')
                        router.push('/dashboard')
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    onClick={handleCreateClick} 
                    className="flex-1"
                  >
                    {isEditMode ? 'Update Trip' : 'Create Load'}
                  </Button>
                </div>
              </form>
            </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <div className="space-y-6">
            {/* Route Optimization for All Loads */}
            <Card>
              <CardHeader>
                <CardTitle>Route Optimization Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View and track optimized truck routes for all loads. Routes are automatically optimized considering truck restrictions, traffic conditions, and delivery schedules.
                </p>
              </CardContent>
            </Card>

            {/* Trip Routes Display */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {loads.filter(trip => trip.status?.toLowerCase() !== 'delivered').map((trip) => {
                const assignments = parseJsonField(trip.vehicleassignments) || []
                const pickupLocations = parseJsonField(trip.pickuplocations) || []
                const dropoffLocations = parseJsonField(trip.dropofflocations) || []
                
                return (
                  <div key={trip.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Route className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{trip.trip_id}</h3>
                            <p className="text-sm text-slate-500">{trip.ordernumber}</p>
                          </div>
                        </div>
                        <span className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide",
                          trip.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          trip.status === "in-transit" ? "bg-blue-100 text-blue-700" :
                          trip.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {trip.status || 'pending'}
                        </span>
                      </div>
                      
                      {/* Client & Commodity */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Client</p>
                          <p className="text-sm font-medium text-slate-900">{trip.clientdetails?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Commodity</p>
                          <p className="text-sm font-medium text-slate-900">{trip.cargo || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="p-6 border-b border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Progress Timeline</h4>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          {[
                            { label: 'Created', completed: true },
                            { label: 'Assigned', completed: assignments.length > 0 },
                            { label: 'In Transit', completed: trip.status === 'in-transit' || trip.status === 'completed' },
                            { label: 'Completed', completed: trip.status === 'completed' }
                          ].map((step, index, array) => (
                            <div key={step.label} className="flex flex-col items-center relative">
                              <div className={cn(
                                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors",
                                step.completed 
                                  ? "bg-slate-600 border-slate-600 text-white" 
                                  : "bg-white border-slate-300 text-slate-400"
                              )}>
                                {index + 1}
                              </div>
                              <span className={cn(
                                "text-xs mt-2 font-medium",
                                step.completed ? "text-slate-900" : "text-slate-400"
                              )}>
                                {step.label}
                              </span>
                              {index < array.length - 1 && (
                                <div className={cn(
                                  "absolute top-4 left-8 w-full h-0.5 -z-10",
                                  step.completed && array[index + 1].completed 
                                    ? "bg-slate-600" 
                                    : "bg-slate-200"
                                )} style={{ width: 'calc(100% + 2rem)' }} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Locations */}
                    <div className="p-6 border-b border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Route Details</h4>
                      <div className="space-y-3">
                        {pickupLocations.map((pickup, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <div className="p-1.5 bg-emerald-100 rounded-full">
                              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">PICKUP</span>
                              </div>
                              <p className="text-sm font-medium text-slate-900 truncate">{pickup.location || pickup.address}</p>
                              <p className="text-xs text-slate-500">{pickup.scheduled_time ? new Date(pickup.scheduled_time).toLocaleString() : 'Time TBD'}</p>
                            </div>
                          </div>
                        ))}
                        {dropoffLocations.map((dropoff, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="p-1.5 bg-red-100 rounded-full">
                              <MapPin className="h-3.5 w-3.5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">DROP-OFF</span>
                              </div>
                              <p className="text-sm font-medium text-slate-900 truncate">{dropoff.location || dropoff.address}</p>
                              <p className="text-xs text-slate-500">{dropoff.scheduled_time ? new Date(dropoff.scheduled_time).toLocaleString() : 'Time TBD'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Assignments */}
                    <div className="p-6">
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Assignments</h4>
                      {assignments.length > 0 ? (
                        <div className="space-y-3">
                          {assignments.map((assignment, index) => (
                            <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Vehicle</p>
                                  <p className="text-sm font-medium text-slate-900">{assignment.vehicle?.name || assignment.vehicle?.registration_number || 'Unassigned'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Driver(s)</p>
                                  <div className="space-y-1">
                                    {assignment.drivers?.filter(d => d.name).map((driver, dIndex) => (
                                      <p key={dIndex} className="text-sm font-medium text-slate-900">{driver.name}</p>
                                    )) || <p className="text-sm text-slate-500">Unassigned</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                          <p className="text-sm text-slate-500">No assignments yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <ClientAddressPopup
        isOpen={showAddressPopup}
        onClose={() => setShowAddressPopup(false)}
        client={selectedClient}
        onUseAsPickup={handleUseAsPickup}
        onUseAsDropoff={handleUseAsDropoff}
        onSkip={handleSkipAddress}
      />
      
      <RouteEditModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        stopPoints={stopPoints}
        customStopPoints={customStopPoints}
        availableStopPoints={availableStopPoints}
        onReorder={(newOrder) => {
          console.log('Reordering stop points:', newOrder)
          setStopPoints(newOrder.stopPoints)
          setCustomStopPoints(newOrder.customStopPoints)
          setIsManuallyOrdered(true)
          setShowRouteModal(false)
          // Don't clear optimized route immediately - let the effect handle it
        }}
        onForceRecalculate={() => {
          console.log('Force recalculating route')
          setIsManuallyOrdered(false)
          setShowRouteModal(false)
          // Don't clear optimized route immediately - let the effect handle it
        }}
      />
      
      <Toast
        open={toast.isVisible}
        onOpenChange={(open) => !open && hideToast()}
        variant={toast.type}
      >
        {toast.message}
      </Toast>
    </div>
  )
}
