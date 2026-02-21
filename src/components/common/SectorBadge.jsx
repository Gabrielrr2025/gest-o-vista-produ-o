import React from 'react';
import { Badge } from "@/components/ui/badge";

const sectorColors = {
  "Padaria": "bg-amber-100 text-amber-800 border-amber-200",
  "Salgados": "bg-orange-100 text-orange-800 border-orange-200",
  "Confeitaria": "bg-pink-100 text-pink-800 border-pink-200",
  "Minimercado": "bg-blue-100 text-blue-800 border-blue-200",
  "Restaurante": "bg-green-100 text-green-800 border-green-200",
  "Frios": "bg-cyan-100 text-cyan-800 border-cyan-200"
};

export default function SectorBadge({ sector, className = "" }) {
  return (
    <Badge 
      variant="outline" 
      className={`${sectorColors[sector] || "bg-gray-100 text-gray-800"} ${className}`}
    >
      {sector}
    </Badge>
  );
}

export const SECTORS = ["Padaria", "Salgados", "Confeitaria", "Minimercado", "Restaurante", "Frios"];
export { sectorColors };