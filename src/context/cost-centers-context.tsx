"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/context/contexts/UserContext";

const SELECTION_STORAGE_KEY = "costCenterSelection-v1";

interface CostCenter {
  id: number;
  name: string;
  code: string;
}

interface CostCentersContextType {
  costCenters: CostCenter[];
  costCenterMap: Map<number, string>;
  loading: boolean;
  getCostCenterName: (id: number | null | undefined) => string;
  selectedCostCenterIds: number[];
  setSelectedCostCenterIds: React.Dispatch<React.SetStateAction<number[]>>;
  toggleCostCenterFilter: (id: number) => void;
  selectedCostCenterSummary: string;
}

const CostCentersContext = createContext<CostCentersContextType>({
  costCenters: [],
  costCenterMap: new Map(),
  loading: false,
  getCostCenterName: () => "",
  selectedCostCenterIds: [],
  setSelectedCostCenterIds: () => {},
  toggleCostCenterFilter: () => {},
  selectedCostCenterSummary: "All Cost Centers",
});

export function CostCentersProvider({ children }: { children: React.ReactNode }) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCostCenterIds, setSelectedCostCenterIds] = useState<number[]>([]);
  const fetchedRef = useRef(false);
  const { userCostCenterIds } = useUser();

  const fetchCostCenters = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("Failed to fetch cost centers:", error);
        return;
      }
      // Deduplicate by name (case-insensitive)
      const seen = new Set<string>();
      const deduped = (data || []).filter((cc: CostCenter) => {
        const key = cc.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // ALWAYS limit to the user's assigned cost centers from the users table,
      // for both admins and non-admins. Admins with no assignment see all.
      if (userCostCenterIds.length > 0) {
        const filtered = deduped.filter(cc => userCostCenterIds.includes(cc.id));
        setCostCenters(filtered);
      } else {
        setCostCenters(deduped);
      }
    } catch (err) {
      console.error("Error fetching cost centers:", err);
    } finally {
      setLoading(false);
    }
  }, [userCostCenterIds]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  // Load saved selection from localStorage once the user's cost centers are known
  useEffect(() => {
    if (costCenters.length === 0) return;
    try {
      const saved = localStorage.getItem(SELECTION_STORAGE_KEY);
      if (saved) {
        const parsed: number[] = JSON.parse(saved);
        // Only keep selections that are in the user's available cost centers
        const valid = parsed.filter(id => costCenters.some(cc => cc.id === id));
        if (valid.length > 0) {
          setSelectedCostCenterIds(valid);
        }
      }
    } catch (e) {
      console.error("Error reading cost center selection:", e);
    }
  }, [costCenters]);

  // Persist selection so it is remembered across tab changes and reloads
  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedCostCenterIds));
    } catch (e) {
      console.error("Error saving cost center selection:", e);
    }
  }, [selectedCostCenterIds]);

  const costCenterMap = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const cc of costCenters) {
      map.set(cc.id, cc.name);
    }
    return map;
  }, [costCenters]);

  const getCostCenterName = useCallback(
    (id: number | null | undefined) => {
      if (!id) return "";
      return costCenterMap.get(id) || "";
    },
    [costCenterMap]
  );

  const toggleCostCenterFilter = useCallback((costCenterId: number) => {
    setSelectedCostCenterIds((prev) => {
      if (prev.includes(costCenterId)) return prev.filter((id) => id !== costCenterId);
      return [...prev, costCenterId];
    });
  }, []);

  const selectedCostCenterSummary = React.useMemo(() => {
    if (selectedCostCenterIds.length === 0) return "All Cost Centers";
    if (selectedCostCenterIds.length === 1) return getCostCenterName(selectedCostCenterIds[0]) || `ID: ${selectedCostCenterIds[0]}`;
    return `${selectedCostCenterIds.length} Cost Centers`;
  }, [selectedCostCenterIds, getCostCenterName]);

  return (
    <CostCentersContext.Provider value={{ costCenters, costCenterMap, loading, getCostCenterName, selectedCostCenterIds, setSelectedCostCenterIds, toggleCostCenterFilter, selectedCostCenterSummary }}>
      {children}
    </CostCentersContext.Provider>
  );
}

export function useCostCenters() {
  return useContext(CostCentersContext);
}
