"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { X, FileText, CheckCircle, AlertTriangle, Clock, TrendingUp, Plus, Route, MapPin } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'
import { RoutePreviewMap } from '@/components/ui/route-preview-map'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { CommodityDropdown } from '@/components/ui/commodity-dropdown'
import { ClientDropdown } from '@/components/ui/client-dropdown'
import { ClientNameDisplay } from '@/components/ui/client-name-display'
import { DriverDropdown } from '@/components/ui/driver-dropdown'
import { VehicleDropdown } from '@/components/ui/vehicle-dropdown'
import { VehicleTypeDropdown } from '@/components/ui/vehicle-type-dropdown'
import { TrailerDropdown } from '@/components/ui/trailer-dropdown'
import { StopPointDropdown } from '@/components/ui/stop-point-dropdown'
import { ElevationModal } from '@/components/ui/elevation-modal'
import { TripHistoryModal } from '@/components/ui/trip-history-modal'

export function EditTripModal({ isOpen, onClose, trip, onUpdate, readOnly = false, showApprovalButtons = false, onApprove, onDecline }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showElevationModal, setShowElevationModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [clients, setClients] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [vehicleTrackingData, setVehicleTrackingData] = useState([])
  const [availableStopPoints, setAvailableStopPoints] = useState([])
  const [isLoadingStopPoints, setIsLoadingStopPoints] = useState(false)

  // Form state
  const [client, setClient] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [commodity, setCommodity] = useState('')
  const [rate, setRate] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [comment, setComment] = useState('')
  const [etaPickup, setEtaPickup] = useState('')
  const [loadingLocation, setLoadingLocation] = useState('')
  const [etaDropoff, setEtaDropoff] = useState('')
  const [dropOffPoint, setDropOffPoint] = useState('')
  const [optimizedRoute, setOptimizedRoute] = useState(null)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Driver assignments state
  const [driverAssignments, setDriverAssignments] = useState([{ id: '', name: '' }])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedTrailerId, setSelectedTrailerId] = useState('')
  const [selectedVehicleType, setSelectedVehicleType] = useState('')
  const [selectedDriverLocation, setSelectedDriverLocation] = useState(null)
  
  // Cost calculation state
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
  const [customStopPoints, setCustomStopPoints] = useState([])
  const [tripDays, setTripDays] = useState(1)

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

  // Fetch stop points function
  const fetchStopPoints = async () => {
    if (availableStopPoints.length > 0) return // Already loaded
    
    setIsLoadingStopPoints(true)
    try {
      const { data: stopPointsData, error: stopPointsError } = await supabase
        .from('stop_points')
        .select('id, name, name2, coordinates')
        .order('name')
      
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

  // Get selected stop points with coordinates including custom locations
  const getSelectedStopPointsData = useCallback(async () => {
    const results = []
    
    for (let i = 0; i < stopPoints.length; i++) {
      const pointId = stopPoints[i]
      const customLocation = customStopPoints[i]
      
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
        // Use existing stop point
        let point = availableStopPoints.find(p => p.id.toString() === pointId)
        
        if (!point) {
          try {
            const { data: pointData, error } = await supabase
              .from('stop_points')
              .select('id, name, name2, coordinates')
              .eq('id', pointId)
              .single()
            
            if (!error && pointData) {
              point = pointData
            }
          } catch (err) {
            console.error('Error fetching individual stop point:', err)
          }
        }
        
        if (point?.coordinates) {
          try {
            const coordPairs = point.coordinates.split(' ')
              .filter(coord => coord.trim())
              .map(coord => {
                const [lng, lat] = coord.split(',')
                return [parseFloat(lng), parseFloat(lat)]
              })
              .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]))
            
            results.push({
              id: point.id,
              name: point.name,
              coordinates: coordPairs
            })
          } catch (error) {
            console.error('Error parsing coordinates:', error)
          }
        }
      }
    }
    
    return results
  }, [stopPoints, customStopPoints, availableStopPoints])

  // Get user role from cookies
  useEffect(() => {
    const getCookie = (name) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    const role = decodeURIComponent(getCookie('role') || '')
    setUserRole(role)
  }, [])

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  const fetchData = async () => {
    try {
      // Fetch only essential data first, then load others in background
      const [vehiclesResult, driversResult] = await Promise.all([
        supabase.from('vehiclesc').select('id, registration_number, vehicle_type').eq('veh_dormant_flag', false),
        supabase.from('drivers').select('id, first_name, surname, available')
      ])
      
      // Format drivers from drivers table
      const formattedDrivers = (driversResult.data || []).map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.surname}`.trim(),
        first_name: driver.first_name || '',
        surname: driver.surname || '',
        available: driver.available
      }))
      
      // Filter available drivers
      const availableDriversList = formattedDrivers.filter(d => d.available === true)
      
      setVehicles(vehiclesResult.data || [])
      setDrivers(formattedDrivers)
      setAvailableDrivers(availableDriversList)
      
      // Load clients and tracking data in background
      Promise.all([
        fetch('/api/eps-client-list').then(res => res.json()).catch(() => ({ data: [] })),
        fetch('http://64.227.138.235:3000/api/eps-vehicles').then(res => res.json()).catch(() => [])
      ]).then(([clientsResponse, trackingData]) => {
        setClients(clientsResponse.data || [])
        const vehicleData = trackingData?.result?.data || trackingData?.data || trackingData || []
        setVehicleTrackingData(vehicleData)
      })
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  // Handle history-only mode
  useEffect(() => {
    if (trip?.showHistoryOnly && isOpen) {
      setShowHistoryModal(true)
      return
    }
  }, [trip, isOpen])

  // Populate form when trip data is available
  useEffect(() => {
    if (trip && isOpen && !trip.showHistoryOnly) {
      const clientDetails = typeof trip.clientdetails === 'string' ? JSON.parse(trip.clientdetails) : trip.clientdetails
      const pickupLocs = trip.pickup_locations || trip.pickuplocations || []
      const dropoffLocs = trip.dropoff_locations || trip.dropofflocations || []
      const assignments = trip.vehicleassignments || trip.vehicle_assignments || []
      const selectedStopPoints = trip.selected_stop_points || trip.selectedstoppoints || []

      setClient(clientDetails?.name || '')
      setSelectedClient(clientDetails)
      setCommodity(trip.cargo || '')
      setRate(trip.rate || '')
      setOrderNumber(trip.ordernumber || '')
      setComment(trip.notes || trip.status_notes || '')
      setLoadingLocation(trip.origin || '')
      setDropOffPoint(trip.destination || '')
      setEtaPickup(pickupLocs[0]?.scheduled_time || '')
      setEtaDropoff(dropoffLocs[0]?.scheduled_time || '')
      setTripType(trip.trip_type || 'local')
      setSelectedVehicleType(trip.selected_vehicle_type || '')
      setFuelPricePerLiter(trip.fuel_price_per_liter?.toString() || '21.55')
      setGoodsInTransitPremium(trip.goods_in_transit_premium?.toString() || '')
      setEstimatedDistance(trip.estimated_distance || 0)
      setApproximateFuelCost(trip.approximate_fuel_cost || 0)
      setApproximatedCPK(trip.approximated_cpk || 0)
      setApproximatedVehicleCost(trip.approximated_vehicle_cost || 0)
      setApproximatedDriverCost(trip.approximated_driver_cost || 0)
      setTotalVehicleCost(trip.total_vehicle_cost || 0)
      
      // Set driver assignments and fetch vehicle details from vehiclesc table
      if (assignments.length > 0) {
        const assignment = assignments[0]
        setDriverAssignments(assignment.drivers || [{ id: '', name: '' }])
        
        // Set vehicle IDs from assignments
        const vehicleId = assignment.vehicle?.id?.toString() || ''
        const trailerId = assignment.trailer?.id?.toString() || ''
        setSelectedVehicleId(vehicleId)
        setSelectedTrailerId(trailerId)
        
        // Fetch additional vehicle details from vehiclesc table if needed
        if (vehicleId && vehicles.length > 0) {
          const vehicleDetails = vehicles.find(v => v.id.toString() === vehicleId)
          if (vehicleDetails && !selectedVehicleType) {
            setSelectedVehicleType(vehicleDetails.vehicle_type || '')
          }
        }
      }
      
      // Set stop points
      if (selectedStopPoints.length > 0) {
        const stopPointIds = selectedStopPoints.map(stop => 
          typeof stop === 'object' ? (stop.id || stop.type === 'existing' ? stop.id : '') : stop
        ).filter(Boolean)
        const customPoints = selectedStopPoints.map(stop => 
          typeof stop === 'object' && stop.type === 'custom' ? stop.name : ''
        )
        setStopPoints(stopPointIds)
        setCustomStopPoints(customPoints)
      }
    }
  }, [trip, isOpen, vehicles])

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

  // Calculate distance from optimized route
  useEffect(() => {
    if (optimizedRoute?.distance) {
      const distanceKm = Math.round(optimizedRoute.distance / 1000)
      setEstimatedDistance(distanceKm)
    } else if (!loadingLocation || !dropOffPoint) {
      setEstimatedDistance(0)
    }
  }, [optimizedRoute, loadingLocation, dropOffPoint])

  // Preview route when locations change
  useEffect(() => {
    const previewRoute = async () => {
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
        
        // Get stop points data if available
        let stopPointsData = []
        if (stopPoints.length > 0 || customStopPoints.some(p => p)) {
          try {
            stopPointsData = await getSelectedStopPointsData()
            stopPointsData = stopPointsData.filter(point => 
              point && point.coordinates && point.coordinates.length > 0
            )
          } catch (error) {
            console.error('Error getting stop points data:', error)
            stopPointsData = []
          }
        }
        
        // Use proxy API for better performance
        const params = new URLSearchParams({
          endpoint: `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loadingLocation)}.json`,
          access_token: mapboxToken,
          country: 'za',
          limit: '1'
        })
        
        const [loadingResponse, dropOffResponse] = await Promise.all([
          fetch(`/api/mapbox?${params}`),
          fetch(`/api/mapbox?${new URLSearchParams({
            endpoint: `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropOffPoint)}.json`,
            access_token: mapboxToken,
            country: 'za',
            limit: '1'
          })}`)
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
          
          // Use proxy API for directions
          const directionsParams = new URLSearchParams({
            endpoint: `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}`,
            geometries: 'geojson',
            overview: 'full',
            exclude: 'ferry'
          })
          
          const directionsResponse = await fetch(`/api/mapbox?${directionsParams}`)
          
          if (directionsResponse.ok) {
            const directionsData = await directionsResponse.json()
            
            if (directionsData.code === 'Ok' && directionsData.routes?.[0]) {
              const route = directionsData.routes[0]
              setOptimizedRoute({
                route: route,
                distance: route.distance,
                duration: route.duration,
                geometry: route.geometry,
                stopPoints: stopPointsData
              })
            }
          }
        }
      } catch (error) {
        console.error('Route preview failed:', error)
        setOptimizedRoute(null)
      }
      setIsOptimizing(false)
    }
    
    const timeoutId = setTimeout(previewRoute, 300)
    return () => clearTimeout(timeoutId)
  }, [loadingLocation, dropOffPoint, stopPoints, customStopPoints, getSelectedStopPointsData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    updateTrip()
  }

  const updateTrip = async () => {
    setLoading(true)

    try {
      if (!trip?.id) {
        throw new Error('Trip ID is missing')
      }

      // Store previous trip data for history
      const previousData = { ...trip }

      const updateData = {
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
        fuel_price_per_liter: parseFloat(fuelPricePerLiter) || null,
        updated_at: new Date().toISOString(),
        
        // Always elevate on edit
        elevate: true
      }

      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Update trip
      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', trip.id)

      if (updateError) throw updateError

      // Store in trip_history table after updateData is defined
      const { error: historyError } = await supabase
        .from('trip_history')
        .insert({
          trip_id: trip.id,
          previous_data: previousData,
          new_data: updateData,
          change_type: 'edit',
          created_at: new Date().toISOString()
        })
      
      if (historyError) {
        console.warn('Failed to store trip history:', historyError)
        // Continue with update even if history fails
      }

      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate()
      }
      if (onClose && typeof onClose === 'function') {
        onClose()
      }
    } catch (err) {
      console.error('Error updating trip:', err)
      alert(`Failed to update trip: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setLoading(true)
    
    try {
      if (!trip?.id) {
        throw new Error('Trip ID is missing')
      }

      // Get the most recent trip history to revert to previous version
      const { data: historyData, error: historyError } = await supabase
        .from('trip_history')
        .select('previous_data')
        .eq('trip_id', trip.id)
        .eq('change_type', 'edit')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let previousData = trip
      
      if (!historyError && historyData?.previous_data) {
        previousData = historyData.previous_data
      }
      
      // Only include valid trip table columns
      const validColumns = [
        'ordernumber', 'rate', 'cargo', 'origin', 'destination', 'notes',
        'clientdetails', 'pickuplocations', 'dropofflocations', 'vehicleassignments',
        'trip_type', 'selected_stop_points', 'selected_vehicle_type',
        'approximate_fuel_cost', 'approximated_cpk', 'approximated_vehicle_cost',
        'approximated_driver_cost', 'total_vehicle_cost', 'goods_in_transit_premium',
        'estimated_distance', 'fuel_price_per_liter', 'status', 'status_notes'
      ]
      
      const revertData = {
        elevate: false,
        updated_at: new Date().toISOString()
      }
      
      // Only add fields that exist in the database
      validColumns.forEach(column => {
        if (previousData.hasOwnProperty(column)) {
          revertData[column] = previousData[column]
        }
      })

      // Update trip with previous data
      const { error: updateError } = await supabase
        .from('trips')
        .update(revertData)
        .eq('id', trip.id)

      if (updateError) throw updateError

      // Store decline action in history
      const { error: declineHistoryError } = await supabase
        .from('trip_history')
        .insert({
          trip_id: trip.id,
          previous_data: trip,
          new_data: revertData,
          change_type: 'decline',
          created_at: new Date().toISOString()
        })
      
      if (declineHistoryError) {
        console.warn('Failed to store decline history:', declineHistoryError)
      }

      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate()
      }
      if (onClose && typeof onClose === 'function') {
        onClose()
      }
    } catch (err) {
      console.error('Error declining trip:', err)
      alert(`Failed to decline trip: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-white rounded-lg shadow-lg overflow-y-auto z-50">
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-xl font-semibold">
              {readOnly ? `Trip Approval - #${trip?.trip_id || trip?.id}` : `Edit Trip #${trip?.trip_id || trip?.id}`}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="p-6">
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Load Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="clientCode">Client Code</Label>
                <ClientDropdown 
                  value={selectedClient ? client : ''} 
                  onChange={(clientData) => {
                    if (typeof clientData === 'object') {
                      setSelectedClient(clientData)
                      setClient(clientData.name)
                    } else {
                      setClient(clientData)
                      setSelectedClient(null)
                    }
                  }} 
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
                <Input value={orderNumber} onChange={readOnly ? undefined : (e) => setOrderNumber(e.target.value)} placeholder="Order Number" readOnly={readOnly} className={readOnly ? 'bg-gray-50' : ''} />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="client">Client</Label>
                <ClientNameDisplay 
                  selectedClient={selectedClient}
                  placeholder="Client name will appear here"
                />
              </div>
              <div>
                <Label htmlFor="rate">Rate</Label>
                <Input value={rate} onChange={readOnly ? undefined : (e) => setRate(e.target.value)} placeholder="Rate" readOnly={readOnly} className={readOnly ? 'bg-gray-50' : ''} />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="comment">Comment</Label>
              <Input value={comment} onChange={readOnly ? undefined : (e) => setComment(e.target.value)} placeholder="Comment (optional)" readOnly={readOnly} className={readOnly ? 'bg-gray-50' : ''} />
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
                onChange={setLoadingLocation}
                placeholder="Search for loading location"
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
                onChange={setDropOffPoint}
                placeholder="Search for drop off location"
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
                  onChange={(e) => setTripType(e.target.value)}
                  className="w-4 h-4"
                />
                <Label htmlFor="national">Long Distance</Label>
              </div>
            </div>
          </div>

          {/* Stop Points */}
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
                        const updated = [...stopPoints]
                        updated[index] = value
                        setStopPoints(updated)
                        const updatedCustom = [...customStopPoints]
                        updatedCustom[index] = ''
                        setCustomStopPoints(updatedCustom)
                      }}
                      stopPoints={availableStopPoints}
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
                  }}
                  placeholder="Search for custom stop location"
                />
              </div>
            ))}
          </div>

          {/* Route Preview */}
          {loadingLocation && dropOffPoint && (
            <div className="space-y-4">
              {isOptimizing && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Optimizing route...
                </div>
              )}
              <RoutePreviewMap
                key={`${loadingLocation}-${dropOffPoint}-${stopPoints.join(',')}-${customStopPoints.join(',')}`}
                origin={loadingLocation}
                destination={dropOffPoint}
                routeData={optimizedRoute}
                stopPoints={stopPoints.length > 0 || customStopPoints.some(p => p) ? 'async' : []}
                getStopPointsData={getSelectedStopPointsData}
              />
              
              {/* Route Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">
                  {tripType === 'local' ? 'Local Route' : 'Long Distance Route'} (Optimized)
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Loading:</span> {loadingLocation}
                  </div>
                  {stopPoints.length > 0 && (
                    <div>
                      <span className="font-medium">Stop Points:</span> {stopPoints.length} stop(s) added
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Drop-off:</span> {dropOffPoint}
                  </div>
                  <div>
                    <span className="font-medium">Trip Type:</span> {tripType === 'local' ? 'Local Trip' : 'Long Distance'}
                  </div>
                  {optimizedRoute && (
                    <div className="border-t pt-2 mt-2">
                      <div className="font-medium text-blue-600 mb-1">Route Information:</div>
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
          )}

          {/* Driver Assignments */}
          <div className="space-y-4">
            <Label className="text-lg font-medium">Driver Assignments</Label>
            {driverAssignments.map((driver, driverIndex) => (
              <div key={driverIndex} className="mb-2">
                <DriverDropdown
                  value={driver.id}
                  onChange={(value) => {
                    const selectedDriver = drivers.find(d => d.id === value)
                    setDriverAssignments(prev => {
                      const updated = [...prev]
                      updated[driverIndex] = { 
                        id: value, 
                        name: selectedDriver?.surname || '',
                        first_name: selectedDriver?.first_name || '',
                        surname: selectedDriver?.surname || ''
                      }
                      return updated
                    })
                  }}
                  drivers={availableDrivers}
                  placeholder="Select available driver"
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
                    <div className="space-y-2 md:col-span-2">
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

          <div className="flex gap-2 pt-4">
            {showApprovalButtons ? (
              <>
                <Button 
                  type="button" 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={onApprove}
                >
                  Approve Trip
                </Button>
                <Button 
                  type="button" 
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDecline}
                  disabled={loading}
                >
                  {loading ? 'Declining...' : 'Decline Trip'}
                </Button>
                {userRole === 'admin' && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowHistoryModal(true)}
                    className="flex-1"
                  >
                    View History
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                {userRole === 'admin' && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowHistoryModal(true)}
                  >
                    View History
                  </Button>
                )}
                {!readOnly && (
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Updating...' : 'Update Trip'}
                  </Button>
                )}
              </>
            )}
          </div>
        </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      

    </Dialog.Root>
    
    {showHistoryModal && (
      <TripHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        tripId={trip?.id}
      />
    )}
    </>
  )
}