import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

const formatYAxis = (value) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value}`;
};

export default function SectorEvolutionChart({ 
  rawData,
  rawLossesData,
  sector,
  type = 'sales'
}) {
  const [groupBy, setGroupBy] = useState('day');

  // Filtrar dados de vendas do setor
  const sectorSalesData = useMemo(() => {
    if (!rawData || !sector) return [];
    return rawData.filter(item => item.setor === sector);
  }, [rawData, sector]);

  // Filtrar dados de perdas do setor (precisa fazer JOIN com produtos)
  const sectorLossesData = useMemo(() => {
    if (!rawLossesData || !sector) return [];
    // As perdas já vem agregadas, não tem campo setor
    // Vamos precisar adaptar isso
    return rawLossesData;
  }, [rawLossesData, sector]);

  const chartData = useMemo(() => {
    if (!sectorSalesData || sectorSalesData.length === 0) {
      return [];
    }

    const salesByGroup = {};
    const lossesByGroup = {};
    
    // Processar vendas
    sectorSalesData.forEach(item => {
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

        if (!salesByGroup[groupKey]) {
          salesByGroup[groupKey] = {
            key: groupKey,
            label: groupLabel,
            vendas: 0,
            perdas: 0
          };
        }

        salesByGroup[groupKey].vendas += parseFloat(item.valor_reais || 0);
      } catch (error) {
        console.error('❌ Erro ao processar vendas:', error);
      }
    });

    // Processar perdas (mesma lógica)
    if (sectorLossesData && sectorLossesData.length > 0) {
      sectorLossesData.forEach(item => {
        try {
          const dateStr = item.data.split('T')[0];
          const fullDate = parseISO(item.data);
          let groupKey;

          switch (groupBy) {
            case 'hour':
              groupKey = `${getHours(fullDate)}`;
              break;
            case 'day':
              groupKey = dateStr;
              break;
            case 'weekday':
              groupKey = `${getDay(fullDate)}`;
              break;
            case 'week':
              groupKey = `${getWeek(fullDate, { weekStartsOn: 1 })}`;
              break;
            case 'month':
              groupKey = format(fullDate, 'yyyy-MM');
              break;
            default:
              groupKey = dateStr;
          }

          if (salesByGroup[groupKey]) {
            salesByGroup[groupKey].perdas += parseFloat(item.valor_reais || 0);
          }
        } catch (error) {
          console.error('❌ Erro ao processar perdas:', error);
        }
      });
    }

    const chartArray = Object.values(salesByGroup)
      .map(group => ({
        date: group.label,
        sortKey: group.key,
        vendas: group.vendas,
        perdas: group.perdas
      }))
      .sort((a, b) => {
        if (groupBy === 'weekday' || groupBy === 'hour') {
          return parseInt(a.sortKey) - parseInt(b.sortKey);
        }
        return a.sortKey.localeCompare(b.sortKey);
      });

    return chartArray;
  }, [sectorSalesData, sectorLossesData, groupBy]);

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
            <ComposedChart 
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
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                iconType="circle"
              />
              
              <Line 
                type="monotone" 
                dataKey="vendas" 
                stroke="#10b981"
                strokeWidth={3}
                name="Vendas"
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
              
              <Line 
                type="monotone" 
                dataKey="perdas" 
                stroke="#ef4444"
                strokeWidth={3}
                name="Perdas"
                dot={{ fill: '#ef4444', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
