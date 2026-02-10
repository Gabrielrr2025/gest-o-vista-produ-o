import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function GeneralEvolutionChart({ 
  rawData, 
  compareRawData = null,
  dateRange,
  compareDateRange = null,
  type = 'sales'
}) {
  console.log('🔍 DEBUG - Dados recebidos:', {
    rawDataLength: rawData?.length,
    rawDataSample: rawData?.[0],
    rawDataFirst5: rawData?.slice(0, 5),
    dateRange,
    dateRangeFrom: dateRange?.from,
    dateRangeTo: dateRange?.to
  });

  console.log('🔍 ESTRUTURA COMPLETA DO PRIMEIRO ITEM:', JSON.stringify(rawData?.[0], null, 2));

  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) {
      console.log('❌ Sem dados para processar');
      return [];
    }

    // Agrupar por data
    const dataByDate = {};
    
    rawData.forEach(item => {
      try {
        // Extrair só a parte da data (YYYY-MM-DD) do timestamp ISO
        let dateKey;
        if (item.data) {
          // Se vier como '2026-01-02T00:00:00.000Z', pegar só '2026-01-02'
          dateKey = item.data.split('T')[0];
        }

        if (!dateKey) {
          console.warn('⚠️ Data inválida:', item);
          return;
        }

        if (!dataByDate[dateKey]) {
          dataByDate[dateKey] = 0;
        }

        dataByDate[dateKey] += parseFloat(item.valor_reais || 0);
      } catch (error) {
        console.error('❌ Erro ao processar item:', item, error);
      }
    });

    console.log('📊 Dados agrupados:', dataByDate);

    // Converter para array e ordenar
    const chartArray = Object.entries(dataByDate)
      .map(([date, value]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        fullDate: date,
        value: value
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    console.log('📈 Array final para gráfico:', {
      length: chartArray.length,
      sample: chartArray.slice(0, 3),
      totalValue: chartArray.reduce((sum, d) => sum + d.value, 0)
    });

    return chartArray;
  }, [rawData]);

  if (!rawData || rawData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            Nenhum dado disponível para o período selecionado
          </p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            Erro ao processar dados. Verifique o console.
          </p>
        </CardContent>
      </Card>
    );
  }

  const lineColor = type === 'sales' ? '#3b82f6' : '#ef4444';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Evolução Temporal - {type === 'sales' ? 'Vendas' : 'Perdas'}
        </CardTitle>
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
              
              {/* Linha principal */}
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={lineColor}
                strokeWidth={2}
                name="Faturamento"
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
