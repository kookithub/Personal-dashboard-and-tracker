"use client";
import Dashboard from "@/components/Dashboard";
import Gate from "@/components/Gate";

export default function Home() {
  return (
    <Gate>
      <Dashboard />
    </Gate>
  );
}
