"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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
}

const CostCentersContext = createContext<CostCentersContextType>({
  costCenters: [],
  costCenterMap: new Map(),
  loading: false,
  getCostCenterName: () => "",
});

export function CostCentersProvider({ children }: { children: React.ReactNode }) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

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
      setCostCenters(deduped);
    } catch (err) {
      console.error("Error fetching cost centers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

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

  return (
    <CostCentersContext.Provider value={{ costCenters, costCenterMap, loading, getCostCenterName }}>
      {children}
    </CostCentersContext.Provider>
  );
}

export function useCostCenters() {
  return useContext(CostCentersContext);
}
