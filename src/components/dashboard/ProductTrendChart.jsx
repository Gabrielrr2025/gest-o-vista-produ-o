import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getWeekBounds } from "./WeekNavigator";
import { getWeek, subWeeks } from "date-fns";

export default function ProductTrendChart({ salesData, lossData, productMap, selectedSector, currentDate }) {
  const [selectedProduct, setSelectedProduct] = useState("");

  // Calcular últimas 6 semanas
  const last6Weeks = useMemo(() => {
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const weekDate = subWeeks(currentDate, i);
      const bounds = getWeekBounds(weekDate);
      const weekNumber = getWeek(bounds.start, { weekStartsOn: 2 }); // Terça como início
      weeks.push({
        weekNumber,
        start: bounds.start,
        end: bounds.end,
        label: `S${weekNumber}`
      });
    }
    return weeks;
  }, [currentDate]);

  // Filtrar produtos por setor
  const availableProducts = useMemo(() => {
    const productNames = new Set();
    
    [...salesData, ...lossData].forEach(record => {
      if (selectedSector === "all" || record.sector === selectedSector) {
        productNames.add(record.product_name);
      }
    });

    return Array.from(productNames).sort();
  }, [salesData, lossData, selectedSector]);

  // Encontrar produto com maior volume de vendas
  const topProduct = useMemo(() => {
    const productSales = {};
    
    salesData.forEach(sale => {
      if (selectedSector === "all" || sale.sector === selectedSector) {
        productSales[sale.product_name] = (productSales[sale.product_name] || 0) + (sale.quantity || 0);
      }
    });

    const sorted = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "";
  }, [salesData, selectedSector]);

  // Definir produto selecionado inicial
  useEffect(() => {
    if (!selectedProduct && topProduct) {
      setSelectedProduct(topProduct);
    }
  }, [topProduct, selectedProduct]);

  // Resetar produto selecionado se não estiver mais disponível
  useEffect(() => {
    if (selectedProduct && !availableProducts.includes(selectedProduct)) {
      setSelectedProduct(topProduct);
    }
  }, [availableProducts, selectedProduct, topProduct]);

  // Calcular dados do gráfico
  const chartData = useMemo(() => {
    if (!selectedProduct) return [];

    return last6Weeks.map(week => {
      const weekStart = week.start.getTime();
      const weekEnd = week.end.getTime();

      const weekSales = salesData.filter(sale => {
        const saleDate = new Date(sale.date).getTime();
        return sale.product_name === selectedProduct &&
               saleDate >= weekStart && 
               saleDate <= weekEnd;
      });

      const weekLosses = lossData.filter(loss => {
        const lossDate = new Date(loss.date).getTime();
        return loss.product_name === selectedProduct &&
               lossDate >= weekStart && 
               lossDate <= weekEnd;
      });

      const totalSales = weekSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const totalLosses = weekLosses.reduce((sum, l) => sum + (l.quantity || 0), 0);

      return {
        week: week.label,
        vendas: totalSales,
        perdas: totalLosses
      };
    });
  }, [selectedProduct, last6Weeks, salesData, lossData]);

  // Obter unidade do produto
  const productUnit = useMemo(() => {
    if (!selectedProduct) return "UN";
    const product = productMap.get(selectedProduct);
    return product?.unit === "kilo" ? "KG" : "UN";
  }, [selectedProduct, productMap]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900 mb-2">{payload[0].payload.week}</p>
          <p className="text-sm text-blue-600">
            {payload[0].value.toFixed(productUnit === "KG" ? 1 : 0)} {productUnit} vendas
          </p>
          <p className="text-sm text-red-600">
            {payload[1].value.toFixed(productUnit === "KG" ? 1 : 0)} {productUnit} perdas
          </p>
        </div>
      );
    }
    return null;
  };

  if (availableProducts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tendência de Vendas e Perdas</CardTitle>
        <div className="mt-3">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Selecione o produto:" />
            </SelectTrigger>
            <SelectContent>
              {availableProducts.map(product => (
                <SelectItem key={product} value={product}>
                  {product}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="week" 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              label={{ value: productUnit, angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="vendas" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Vendas"
            />
            <Line 
              type="monotone" 
              dataKey="perdas" 
              stroke="#ef4444" 
              strokeWidth={2}
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
              name="Perdas"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}