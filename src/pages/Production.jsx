import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { subDays } from "date-fns";
import DateRangePicker from "../components/common/DateRangePicker";
import SectorFilter from "../components/common/SectorFilter";
import ProductionSuggestion from "../components/production/ProductionSuggestion";

export default function Production() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [selectedSector, setSelectedSector] = useState(null);

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sugestão de Produção</h1>
          <p className="text-sm text-slate-500 mt-1">Calcule automaticamente a quantidade ideal a produzir</p>
        </div>
        <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
      </div>

      <SectorFilter selectedSector={selectedSector} setSelectedSector={setSelectedSector} />

      <ProductionSuggestion
        salesData={salesRecords}
        lossData={lossRecords}
        products={products}
        calendarEvents={calendarEvents}
        dateRange={dateRange}
        selectedSector={selectedSector}
      />
    </div>
  );
}