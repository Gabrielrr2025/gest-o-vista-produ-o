import React from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import CalendarManager from "../components/calendar/CalendarManager";

export default function Calendar() {
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
        <p className="text-sm text-slate-500 mt-1">Configure feriados e eventos que impactam a produção</p>
      </div>

      <CalendarManager events={events} onRefresh={handleRefresh} />
    </div>
  );
}