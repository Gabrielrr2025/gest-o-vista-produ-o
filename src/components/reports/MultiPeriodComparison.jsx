import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, Plus } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PERIOD_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Período Base' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: 'Período 2' },
  { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'Período 3' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', label: 'Período 4' }
];

export default function MultiPeriodComparison({ basePeriod, onBasePeriodChange, onPeriodsChange }) {
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePeriods, setComparePeriods] = useState([]);

  const handleToggleCompare = (enabled) => {
    setCompareEnabled(enabled);
    if (!enabled) {
      setComparePeriods([]);
      onPeriodsChange([]);
    }
  };

  const handleAddPeriod = () => {
    if (comparePeriods.length < 3) {
      const newPeriod = {
        id: Date.now(),
        range: null
      };
      const updated = [...comparePeriods, newPeriod];
      setComparePeriods(updated);
    }
  };

  const handleRemovePeriod = (id) => {
    const updated = comparePeriods.filter(p => p.id !== id);
    setComparePeriods(updated);
    onPeriodsChange(updated);
  };

  const handlePeriodChange = (id, range) => {
    const updated = comparePeriods.map(p => 
      p.id === id ? { ...p, range } : p
    );
    setComparePeriods(updated);
    onPeriodsChange(updated);
  };

  const formatPeriodLabel = (range) => {
    if (!range?.from || !range?.to) return "Selecione o período";
    return `${format(range.from, 'dd/MM/yyyy')} - ${format(range.to, 'dd/MM/yyyy')}`;
  };

  return (
    <div className="space-y-4">
      {/* Toggle Comparação */}
      <div className="flex items-center gap-3">
        <Switch
          id="compare-toggle"
          checked={compareEnabled}
          onCheckedChange={handleToggleCompare}
        />
        <Label htmlFor="compare-toggle" className="text-base font-medium cursor-pointer">
          Comparar Múltiplos Períodos
        </Label>
      </div>

      {compareEnabled && (
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Período Base */}
              <div className={`p-4 rounded-lg border-2 ${PERIOD_COLORS[0].border} ${PERIOD_COLORS[0].bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <Label className={`font-semibold ${PERIOD_COLORS[0].text}`}>
                    {PERIOD_COLORS[0].label} (Referência)
                  </Label>
                </div>
                <DateRangePicker 
                  value={basePeriod}
                  onChange={onBasePeriodChange}
                />
              </div>

              {/* Períodos de Comparação */}
              {comparePeriods.map((period, index) => {
                const colorIndex = index + 1;
                const colors = PERIOD_COLORS[colorIndex];
                
                return (
                  <div 
                    key={period.id} 
                    className={`p-4 rounded-lg border-2 ${colors.border} ${colors.bg}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Label className={`font-semibold ${colors.text}`}>
                        {colors.label}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePeriod(period.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <DateRangePicker 
                      value={period.range}
                      onChange={(range) => handlePeriodChange(period.id, range)}
                    />
                  </div>
                );
              })}

              {/* Botão Adicionar Período */}
              {comparePeriods.length < 3 && (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={handleAddPeriod}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Período {comparePeriods.length + 2}
                </Button>
              )}

              {/* Resumo */}
              {comparePeriods.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Comparando {comparePeriods.length + 1} período(s):
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${PERIOD_COLORS[0].bg} border ${PERIOD_COLORS[0].border}`} />
                      Base: {formatPeriodLabel(basePeriod)}
                    </li>
                    {comparePeriods.map((period, index) => (
                      <li key={period.id} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${PERIOD_COLORS[index + 1].bg} border ${PERIOD_COLORS[index + 1].border}`} />
                        {PERIOD_COLORS[index + 1].label}: {formatPeriodLabel(period.range)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
