"use client"
//import ArchiveActions from "";


import TopFiltersField from "../../_components/(booking)/TopFiltersField"
import { BookingFieldEditor } from "../../_components/(booking)/BookingFieldEditor";
import { MessageSender } from "../../_components/(booking)/MessageSender";
import { ArchiveTable } from "../../_components/(booking)/ArchiveTable";


export default function BookingDashboard() {

  // example employees 
  const employees = [
    { id: "1", name: "Janis Otmans" },
    { id: "2", name: "Ralfs Kolveits" },
  ]

  // handlers
  const handleSendEmail = async (recipient: string, type: string) => {
    console.log("Send email:", { recipient, type });
    // await fetch("/api/send-email", { ... })
  };

  const handleSendGSM = async (recipient: string) => {
    console.log("Send GSM:", { recipient });
    // await fetch("/api/send-GSM", { ... })
  };

  const handleCopySelected = () => {
    console.log("Copy selected bookings");
    // navigator.clipboard.writeText(...)
  };

  const handleExportExcel = () => {
    console.log("Export selected to Excel");
    // window.location.href = "/api/export/excel"
  };


  return (
    <section className="flex-1 flex flex-col min-h-0">
      <TopFiltersField/>
      <BookingFieldEditor 
          selectedCount={0} statusOptions={[]} subcontractorOptions={[]} onUpdateStatus={function (status: string): void | Promise<void> {
            throw new Error("Function not implemented.");
          } } onUpdateSubcontractor={function (subcontractorId: string): void | Promise<void> {
            throw new Error("Function not implemented.");
          } } onUpdateDriverText={function (text: string): void | Promise<void> {
            throw new Error("Function not implemented.");
          } }/>
      <MessageSender
        employees={employees}
        onSendEmail={(id, type) => {
          console.log("email →", id, type);
        }}
        onSendGsm={(id) => {
          console.log("sms →", id);
        }}
        onCopySelected={() => console.log("copy")}
        onExportExcel={() => console.log("excel")}
      />
      {/* Archive table */}
      <div className="flex-1 overflow-auto py-4">
        <ArchiveTable/>
      </div>
    </section>
  );
}
