import React from 'react';
import { format } from "date-fns";

export interface NCRData {
  id: string;
  docNumber: string;
  revisionDate: string;
  driverName: string;
  department: string;
  manager: string;
  section: string;
  dateRecorded: string;
  timeRecorded: string;
  duration: string;
  fleetNumber: string;
  location: string;
  classification: {
    speeding: boolean;
    trafficViolation: boolean;
    recklessDriving: boolean;
    negligence: boolean;
    insubordination: boolean;
    noSeatbelt: boolean;
    unauthorizedPassenger: boolean;
    fatigue: boolean;
    other: boolean;
    otherText?: string;
  };
  description: string;
  evidenceImageUrl?: string;
  rootCause: {
    unsafeActs: string[];
    unsafeConditions: string[];
    personalFactors: string[];
  };
  riskRating: 'High' | 'Medium' | 'Low';
}

const CheckBox = ({ checked, label }: { checked: boolean; label?: string }) => (
  <div className="flex items-center gap-1">
    <div className="w-4 h-4 border border-black flex items-center justify-center text-xs font-bold leading-none">
      {checked ? 'X' : ''}
    </div>
    {label && <span className="text-[10px] leading-tight">{label}</span>}
  </div>
);

export const NCRTemplate = ({ data }: { data: NCRData }) => {
  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white p-8 text-black print:p-0 print:max-w-none">
      {/* Main Container Border */}
      <div className="border-2 border-black">
        
        {/* HEADER */}
        <div className="flex border-b-2 border-black">
          <div className="w-1/4 border-r border-black p-2 flex items-center justify-center">
            {/* Logo Placeholder */}
            <h1 className="text-2xl font-black text-slate-800 italic">PREMIER</h1>
          </div>
          <div className="w-1/2 border-r border-black">
             <div className="border-b border-black p-1 text-center font-bold text-lg bg-slate-200">
               PREMIER LOGISTICS SOLUTIONS
             </div>
             <div className="border-b border-black p-2 text-center font-bold bg-slate-100">
               Risk Non – Conformance Report
             </div>
             <div className="p-2 text-center text-sm">
                Meyerton
             </div>
          </div>
          <div className="w-1/4 text-[10px]">
             <div className="flex border-b border-black">
                <div className="w-1/2 p-1 border-r border-black bg-slate-200 font-bold">Document Number</div>
                <div className="w-1/2 p-1 text-center font-mono">Non-Conformance-00</div>
             </div>
             <div className="flex border-b border-black">
                <div className="w-1/2 p-1 border-r border-black bg-slate-200 font-bold">Revision / Date</div>
                <div className="w-1/2 p-1 text-center">{data.revisionDate}</div>
             </div>
             <div className="flex border-b border-black">
                <div className="w-1/2 p-1 border-r border-black bg-slate-200 font-bold">Page Number</div>
                <div className="w-1/2 p-1 text-center">Page 1 of 1</div>
             </div>
          </div>
        </div>

        {/* TOP META ROW */}
        <div className="flex border-b-2 border-black text-xs">
           <div className="flex-1 p-2 flex gap-4 items-center">
             <span>Safety</span> <CheckBox checked={true} />
             <span>Health/Envir</span> <CheckBox checked={false} />
             <span>Quality</span> <CheckBox checked={false} />
           </div>
           <div className="w-1/4 border-l border-black p-2 bg-slate-100 font-bold">NCR No:</div>
           <div className="w-1/4 border-l border-black p-2 font-mono font-bold">{data.id}</div>
        </div>

        {/* SECTION A: Implicated Entity */}
        <div className="border-b-2 border-black">
           <div className="bg-slate-300 font-bold px-2 py-1 text-xs border-b border-black">
              Implicated Entity Information
           </div>
           <table className="w-full text-xs">
              <tbody>
                 <tr className="border-b border-black">
                    <td className="w-[15%] bg-slate-100 p-1 border-r border-black font-semibold">Name</td>
                    <td className="w-[35%] p-1 border-r border-black">{data.driverName}</td>
                    <td className="w-[15%] bg-slate-100 p-1 border-r border-black font-semibold">Department</td>
                    <td className="w-[35%] p-1">{data.department}</td>
                 </tr>
                 <tr>
                    <td className="bg-slate-100 p-1 border-r border-black font-semibold">Responsible Manager</td>
                    <td className="p-1 border-r border-black">{data.manager}</td>
                    <td className="bg-slate-100 p-1 border-r border-black font-semibold">Section</td>
                    <td className="p-1">{data.section}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        {/* NON-CONFORMANCE INFORMATION */}
        <div className="border-b-2 border-black">
           <div className="bg-slate-300 font-bold px-2 py-1 text-xs border-b border-black uppercase">
              Non-Conformance Information
           </div>
           <table className="w-full text-xs">
              <tbody>
                 <tr className="border-b border-black">
                    <td className="bg-slate-100 p-1 border-r border-black w-[15%]">Date Recorded</td>
                    <td className="p-1 border-r border-black w-[25%] text-center">{data.dateRecorded}</td>
                    <td className="bg-slate-100 p-1 border-r border-black w-[10%]">Time</td>
                    <td className="p-1 border-r border-black w-[20%] text-center">{data.timeRecorded}</td>
                    <td className="bg-slate-100 p-1 border-r border-black w-[10%]">Duration</td>
                    <td className="p-1 w-[20%]">{data.duration}</td>
                 </tr>
                 <tr>
                    <td className="bg-slate-100 p-1 border-r border-black">Vehicle Fleet No</td>
                    <td className="p-1 border-r border-black font-bold">{data.fleetNumber}</td>
                    <td className="bg-slate-100 p-1 border-r border-black">Area</td>
                    <td colSpan={3} className="p-1 font-mono text-[10px]">{data.location}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        {/* CLASSIFICATION */}
        <div className="border-b-2 border-black">
           <div className="bg-slate-300 font-bold px-2 py-1 text-xs border-b border-black uppercase">
              Classification of Non-Conformance
           </div>
           <div className="grid grid-cols-4 gap-0 text-[10px]">
              <div className="border-r border-b border-black p-1">Injury</div>
              <div className="border-r border-b border-black p-1 flex items-center justify-between">
                 Negligence of Driver <CheckBox checked={data.classification.negligence} />
              </div>
              <div className="border-r border-b border-black p-1 flex items-center justify-between">
                 Insubordination <CheckBox checked={data.classification.insubordination} />
              </div>
              <div className="border-b border-black p-1 flex items-center justify-between bg-yellow-100">
                 Speeding Violation <CheckBox checked={data.classification.speeding} />
              </div>

               <div className="border-r border-b border-black p-1 flex items-center justify-between bg-yellow-100">
                 Reckless Driving <CheckBox checked={data.classification.recklessDriving} />
              </div>
              <div className="border-r border-b border-black p-1">Poor Fatigue Management</div>
              <div className="border-r border-b border-black p-1">Carrying Unauthorized Passenger</div>
              <div className="border-b border-black p-1 flex items-center justify-between bg-yellow-100">
                 Traffic Violation <CheckBox checked={data.classification.trafficViolation} />
              </div>

               <div className="border-r border-black p-1">Customer Complaints</div>
              <div className="border-r border-black p-1">External / Community Complaints</div>
              <div className="border-r border-black p-1">Other: {data.classification.other ? 'Yes' : ''}</div>
              <div className="border-black p-1">Inadequate Loading Equipment</div>
           </div>
        </div>

        {/* DESCRIPTION + IMAGE */}
        <div className="border-b-2 border-black flex">
           {/* Sidebar Label */}
           <div className="w-[40px] bg-slate-200 border-r border-black flex items-center justify-center writing-mode-vertical rotate-180 p-1 text-[10px] font-bold text-center whitespace-nowrap" style={{writingMode: 'vertical-lr'}}>
              A: INCIDENT / NON-CONFORMANCE
           </div>
           <div className="flex-1">
              <div className="border-b border-black p-1 font-bold text-xs underline">
                 Description of non-conformance
              </div>
              <div className="p-2 text-xs leading-relaxed min-h-[100px] border-b border-black whitespace-pre-line">
                 {data.description}
              </div>
              {data.evidenceImageUrl && (
                <div className="p-4 flex justify-center bg-black/5">
                   <div className="relative border-2 border-slate-400 p-1 bg-white shadow-sm max-w-[400px]">
                      <img src={data.evidenceImageUrl} className="w-full h-auto object-contain" alt="Evidence" />
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-1 font-bold">LIVE</div>
                   </div>
                </div>
              )}
           </div>
        </div>

        {/* ROOT CAUSE */}
         <div className="border-b-2 border-black flex">
           <div className="w-[40px] bg-slate-200 border-r border-black flex items-center justify-center p-1 text-[10px] font-bold text-center" style={{writingMode: 'vertical-lr'}}>
              B: INVESTIGATION
           </div>
           <div className="flex-1">
              <div className="border-b border-black p-1 font-bold text-xs bg-slate-100">
                 ROOT CAUSE ANALYSIS (What is the root cause or neglect for the condition?)
              </div>
              
              <div className="grid grid-cols-3 text-[10px]">
                 <div className="border-r border-b border-black font-bold p-1 bg-slate-50 text-center">Unsafe Acts</div>
                 <div className="border-r border-b border-black font-bold p-1 bg-slate-50 text-center">Unsafe Conditions</div>
                 <div className="border-b border-black font-bold p-1 bg-slate-50 text-center">Personal Factors</div>
                
                 {/* Row 1 */}
                 <div className="border-r border-b border-black p-1">Operating without authority</div>
                 <div className="border-r border-b border-black p-1 bg-yellow-100 font-bold">Improper attitude or motivation</div>
                 <div className="border-b border-black p-1">Physical/Mental incompatibility</div>

                 {/* Row 2 */}
                 <div className="border-r border-b border-black p-1 bg-yellow-100 font-bold">Taking an unsafe position</div>
                 <div className="border-r border-b border-black p-1">Lack of knowledge or skill</div>
                 <div className="border-b border-black p-1 bg-yellow-100 font-bold">Operating at unsafe speed</div>
              
                 {/* Row 3 */}
                 <div className="border-r border-b border-black p-1">Hazardous arrangement</div>
                 <div className="border-r border-b border-black p-1">Ignoring SHE Regulations</div>
                 <div className="border-b border-black p-1">Ignoring Road Traffic Act</div>
              </div>

              <div className="flex border-t border-black text-xs">
                 <div className="p-1 font-bold w-1/4 border-r border-black">RISK RATING</div>
                 <div className="flex-1 flex">
                    <div className="flex-1 border-r border-black p-1 flex justify-between bg-slate-50">High Risk <span className="font-bold">{data.riskRating === 'High' ? 'X' : ''}</span></div>
                    <div className="flex-1 border-r border-black p-1 flex justify-between">Medium Risk <span className="font-bold">{data.riskRating === 'Medium' ? 'X' : ''}</span></div>
                    <div className="flex-1 p-1 flex justify-between">Low Risk <span className="font-bold">{data.riskRating === 'Low' ? 'X' : ''}</span></div>
                 </div>
              </div>
           </div>
         </div>

         {/* ACTION PLAN */}
         <div className="border-b-2 border-black flex min-h-[150px]">
           <div className="w-[40px] bg-slate-200 border-r border-black flex items-center justify-center p-1 text-[10px] font-bold text-center" style={{writingMode: 'vertical-lr'}}>
              C: ACTION
           </div>
           <div className="flex-1 text-xs">
              <div className="grid grid-cols-12 h-1/2 border-b border-black">
                 <div className="col-span-8 p-1 border-r border-black">
                    <span className="font-bold underline">Corrective Action</span>
                    <p className="mt-1 text-slate-500 italic">Immediate disciplinary hearing scheduled. Counseling on speed limits.</p>
                 </div>
                 <div className="col-span-2 p-1 border-r border-black bg-slate-50">
                    <span className="font-bold">Responsibility</span>
                    <p>Divan/Manie</p>
                 </div>
                 <div className="col-span-2 p-1">
                    <span className="font-bold">Target Date</span>
                    <p>04/01/2025</p>
                 </div>
              </div>
              <div className="grid grid-cols-12 h-1/2">
                 <div className="col-span-8 p-1 border-r border-black">
                    <span className="font-bold underline">Preventive Action</span>
                    <p className="mt-1 text-slate-500 italic">Driver retraining module on Heavy Vehicle Speed regulations.</p>
                 </div>
                 <div className="col-span-2 p-1 border-r border-black bg-slate-50">
                    <span className="font-bold">Responsibility</span>
                    <p>Training Dept</p>
                 </div>
                 <div className="col-span-2 p-1">
                    <span className="font-bold">Target Date</span>
                    <p>10/01/2025</p>
                 </div>
              </div>
           </div>
         </div>

         {/* SIGN OFF */}
         <div className="flex text-xs">
            <div className="w-[40px] bg-slate-200 border-r border-black flex items-center justify-center p-1 text-[10px] font-bold text-center" style={{writingMode: 'vertical-lr'}}>
              D: FEEDBACK
           </div>
           <div className="flex-1">
              <div className="grid grid-cols-12 border-b border-black">
                  <div className="col-span-2 p-2 font-bold border-r border-black bg-slate-100">ACTION TAKEN</div>
                  <div className="col-span-4 p-2 border-r border-black flex gap-4">
                     <span>Yes <CheckBox checked={true} /></span>
                     <span>No <CheckBox checked={false} /></span>
                  </div>
                  <div className="col-span-2 p-2 font-bold border-r border-black bg-slate-100">ACTION EFFECTIVE</div>
                  <div className="col-span-4 p-2 flex gap-4">
                     <span>Yes <CheckBox checked={false} /></span>
                     <span>No <CheckBox checked={false} /></span>
                  </div>
              </div>
              <div className="grid grid-cols-12">
                 <div className="col-span-2 p-2 border-r border-black">Investigator</div>
                 <div className="col-span-3 p-2 border-r border-black font-signature text-lg">Werner</div>
                 <div className="col-span-1 p-2 border-r border-black bg-slate-50">Date</div>
                 <div className="col-span-2 p-2 border-r border-black font-mono">03/01/2025</div>
                 
                 <div className="col-span-2 p-2 border-r border-black">Manager</div>
                 <div className="col-span-2 p-2 font-signature text-lg">Divan</div>
              </div>
           </div>
         </div>

      </div>
      
      <div className="mt-8 text-center print:hidden">
         <p className="text-sm text-slate-500 mb-2">System Generated Document - SRS Video Analytics</p>
      </div>
    </div>
  );
};
