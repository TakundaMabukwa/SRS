'use client'

import React from "react"
import { FinancialAuditTab } from './financial-audit-tab'

export default function AuditPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Audit Dashboard</h1>
      </div>
      <FinancialAuditTab />
    </div>
  )
}
