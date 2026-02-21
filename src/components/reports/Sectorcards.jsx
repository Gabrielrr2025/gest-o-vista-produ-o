import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const SECTOR_COLORS = {
  'Padaria': 'bg-amber-500',
  'Confeitaria': 'bg-pink-500',
  'Salgados': 'bg-orange-500',
  'Frios': 'bg-blue-500',
  'Restaurante': 'bg-green-500',
  'Minimercado': 'bg-purple-500'
};

export default function SectorCards({ 
  sectors, 
  compareSectors = null, 
  selectedSector, 
  onSectorClick,
  totalGeral,
  showLosses = false
}) {
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {sectors.map((sector) => {
        const isSelected = selectedSector === sector.setor;
        const percentage = totalGeral > 0 ? (parseFloat(sector.total_valor) / totalGeral) * 100 : 0;
        
        // Calcular variação se tiver comparação
        const compareSector = compareSectors?.find(s => s.setor === sector.setor);
        const change = compareSector ? 
          calculateChange(parseFloat(sector.total_valor), parseFloat(compareSector.total_valor)) : 
          null;

        const sectorColor = SECTOR_COLORS[sector.setor] || 'bg-slate-500';

        // Perdas (se disponível)
        const losses = sector.total_losses || 0;

        return (
          <Card 
            key={sector.setor}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
            }`}
            onClick={() => onSectorClick(sector.setor)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${sectorColor}`} />
                <CardTitle className="text-sm font-medium text-slate-700">
                  {sector.setor}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Valor Principal */}
              <div className="mb-2">
                <div className="text-2xl font-bold text-slate-900">
                  R$ {(parseFloat(sector.total_valor) / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {percentage.toFixed(1)}% do total
                </div>
              </div>

              {/* Variação */}
              {change !== null && (
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  change > 0 ? 'text-green-600' : 
                  change < 0 ? 'text-red-600' : 
                  'text-slate-500'
                }`}>
                  {change > 0 ? <ArrowUp className="w-4 h-4" /> : 
                   change < 0 ? <ArrowDown className="w-4 h-4" /> : 
                   <Minus className="w-4 h-4" />}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              )}

              {/* Perdas (se habilitado) */}
              {showLosses && losses > 0 && (
                <div className="text-xs mt-2 text-red-600 font-medium">
                  Perdas: R$ {(losses / 1000).toFixed(1)}k
                </div>
              )}

              {/* Taxa de Perda (se disponível) */}
              {sector.taxa_perda !== undefined && (
                <div className={`text-xs mt-2 ${
                  sector.taxa_perda > 10 ? 'text-red-600' : 
                  sector.taxa_perda > 5 ? 'text-orange-600' : 
                  'text-slate-600'
                }`}>
                  Taxa perda: {sector.taxa_perda.toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
