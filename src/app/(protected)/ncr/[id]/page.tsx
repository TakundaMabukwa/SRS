"use client";

import React, { useEffect, useState, use } from "react";
import { NCRTemplate, NCRData } from "@/components/reports/ncr-template";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";

// Mock Data Generator for the specific ID
const getNCRData = (id: string): NCRData => {
  return {
    id: "SAB001/25",
    docNumber: "Non-Conformance-00",
    revisionDate: "18th June 2025",
    driverName: "Jeremiah",
    department: "Great Freight",
    manager: "Divan/Manie",
    section: "SAB",
    dateRecorded: "03/01/2025",
    timeRecorded: "12:08",
    duration: "Multiple times",
    fleetNumber: "B16",
    location: "R61 Qamata Basin",
    classification: {
      speeding: true,
      trafficViolation: true,
      recklessDriving: true,
      negligence: false,
      insubordination: false,
      noSeatbelt: false,
      unauthorizedPassenger: false,
      fatigue: false,
      other: false,
    },
    description: "The Driver Jeremiah on B16 was seen exceeding the designated speed limits for the SAB division. Standard speed limit for this division is set at 80km/h; however an allowance of 85km/h is permitted for overtaking maneuvers. This vehicle reached a speed of 90KM/H as stated on the speed reports.",
    evidenceImageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=1000&auto=format&fit=crop", // Placeholder
    rootCause: {
      unsafeActs: ["Taking an unsafe position", "Operating at unsafe speed"],
      unsafeConditions: ["Improper attitude or motivation", "Hazardous arrangement"],
      personalFactors: ["Lack of knowledge or skill"],
    },
    riskRating: 'High',
  };
};

export default function NCRPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [data, setData] = useState<NCRData | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Simulate fetch
    setData(getNCRData(unwrappedParams.id));
  }, [unwrappedParams.id]);

  const handlePrint = () => {
    window.print();
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="flex justify-between items-center w-full">
        <h1 className="text-3xl font-bold">Draft Report</h1>
      </div>
      
      {/* Interaction Bar - Hidden on Print */}
      <div className="w-full max-w-[210mm] flex justify-between items-center print:hidden gap-4">
         <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
         </Button>
         <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
               <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
               <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
         </div>
      </div>

      {/* Printable Area */}
      <div className="print:w-full print:h-full print:absolute print:top-0 print:left-0 print:m-0 print:bg-white w-full flex justify-center">
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              background: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact; 
            }
            /* Hide everything that is NOT the NCR template if wrapper logic fails, 
               but usually standard print:hidden classes work fine */
          }
        `}</style>
        <div className="shadow-xl print:shadow-none bg-white w-full max-w-[210mm]">
           <NCRTemplate data={data} />
        </div>
      </div>
    </div>
  );
}
