import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, getHours, getDay, getWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GROUPING_OPTIONS = [
  { value: 'hour', label: 'Por hora' },
  { value: 'day', label: 'Por dia' },
  { value: 'weekday', label: 'Por dia da semana' },
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mês' }
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold text-slate-900">
              R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const formatYAxis = (value) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value}`;
};

export default function SectorEvolutionChart({ 
  rawData,
  sector,
  type = 'sales'
}) {
  const [groupBy, setGroupBy] = useState('day');

  // Filtrar apenas dados do setor selecionado
  const sectorRawData = useMemo(() => {
    if (!rawData || !sector) return [];
    
    return rawData.filter(item => item.setor === sector);
  }, [rawData, sector]);

  const chartData = useMemo(() => {
    if (!sectorRawData || sectorRawData.length === 0) {
      return [];
    }

    const dataByGroup = {};
    
    sectorRawData.forEach(item => {
      try {
        const dateStr = item.data.split('T')[0];
        const fullDate = parseISO(item.data);
        let groupKey;
        let groupLabel;

        switch (groupBy) {
          case 'hour':
            const hour = getHours(fullDate);
            groupKey = `${hour}`;
            groupLabel = `${hour.toString().padStart(2, '0')}h`;
            break;

          case 'day':
            groupKey = dateStr;
            groupLabel = format(fullDate, 'dd/MM', { locale: ptBR });
            break;

          case 'weekday':
            const weekday = getDay(fullDate);
            groupKey = `${weekday}`;
            groupLabel = WEEKDAY_NAMES[weekday];
            break;

          case 'week':
            const week = getWeek(fullDate, { weekStartsOn: 1 });
            groupKey = `${week}`;
            groupLabel = `Semana ${week}`;
            break;

          case 'month':
            const month = format(fullDate, 'yyyy-MM');
            groupKey = month;
            groupLabel = format(fullDate, 'MMM/yy', { locale: ptBR });
            break;

          default:
            groupKey = dateStr;
            groupLabel = format(fullDate, 'dd/MM', { locale: ptBR });
        }

        if (!dataByGroup[groupKey]) {
          dataByGroup[groupKey] = {
            key: groupKey,
            label: groupLabel,
            value: 0
          };
        }

        dataByGroup[groupKey].value += parseFloat(item.valor_reais || 0);
      } catch (error) {
        console.error('❌ Erro ao processar item:', item, error);
      }
    });

    const chartArray = Object.values(dataByGroup)
      .map(group => ({
        date: group.label,
        sortKey: group.key,
        value: group.value
      }))
      .sort((a, b) => {
        if (groupBy === 'weekday' || groupBy === 'hour') {
          return parseInt(a.sortKey) - parseInt(b.sortKey);
        }
        return a.sortKey.localeCompare(b.sortKey);
      });

    return chartArray;
  }, [sectorRawData, groupBy]);

  if (!sector) {
    return null;
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            Nenhum dado disponível para {sector}
          </p>
        </CardContent>
      </Card>
    );
  }

  const lineColor = type === 'sales' ? '#3b82f6' : '#ef4444';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              Evolução - {sector}
            </CardTitle>
            <Badge variant="outline">{sector}</Badge>
          </div>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPING_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                angle={groupBy === 'day' ? -45 : 0}
                textAnchor={groupBy === 'day' ? 'end' : 'middle'}
                height={groupBy === 'day' ? 60 : 30}
              />
              <YAxis 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              />
              
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={lineColor}
                strokeWidth={2}
                name={`Faturamento - ${sector}`}
                dot={{ fill: lineColor, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
