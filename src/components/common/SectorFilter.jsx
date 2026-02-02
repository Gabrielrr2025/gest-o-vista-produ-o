import React from 'react';
import { Button } from "@/components/ui/button";
import { SECTORS, sectorColors } from "./SectorBadge";

export default function SectorFilter({ selectedSector, setSelectedSector }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        className={`text-xs ${!selectedSector ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`}
        onClick={() => setSelectedSector(null)}
      >
        Todos
      </Button>
      {SECTORS.map(sector => (
        <Button
          key={sector}
          variant="outline"
          size="sm"
          className={`text-xs ${
            selectedSector === sector 
              ? sectorColors[sector] + " border-2"
              : ""
          }`}
          onClick={() => setSelectedSector(sector)}
        >
          {sector}
        </Button>
      ))}
    </div>
  );
}