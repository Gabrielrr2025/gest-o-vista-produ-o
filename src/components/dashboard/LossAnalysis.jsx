import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function LossAnalysis({ salesData, lossData, historicalLossData, productMap }) {
  const lossAnalysis = useMemo(() => {
    // Agrupar vendas por produto
    const productSales = {};
    salesData.forEach(sale => {
      const key = sale.product_name;
      if (!productSales[key]) {
        productSales[key] = { sales: 0 };
      }
      productSales[key].sales += sale.quantity || 0;
    });

    // Agrupar perdas por produto
    const productLosses = {};
    lossData.forEach(loss => {
      const key = loss.product_name;
      if (!productLosses[key]) {
        const product = productMap.get(loss.product_name);
        productLosses[key] = {
          name: loss.product_name,
          loss: 0,
          unit: product?.unit === 'kilo' ? 'KG' : 'UN'
        };
      }
      productLosses[key].loss += loss.quantity || 0;
    });

    // Calcular médias históricas (últimas 4 semanas)
    const historicalAverages = {};
    if (historicalLossData && historicalLossData.length > 0) {
      const historicalSales = {};
      const historicalLosses = {};

      historicalLossData.forEach(item => {
        if (item.type === 'sale') {
          if (!historicalSales[item.product_name]) historicalSales[item.product_name] = 0;
          historicalSales[item.product_name] += item.quantity || 0;
        } else if (item.type === 'loss') {
          if (!historicalLosses[item.product_name]) historicalLosses[item.product_name] = 0;
          historicalLosses[item.product_name] += item.quantity || 0;
        }
      });

      Object.keys(historicalLosses).forEach(productName => {
        const totalSales = historicalSales[productName] || 0;
        const totalLoss = historicalLosses[productName] || 0;
        if (totalSales > 0) {
          historicalAverages[productName] = (totalLoss / totalSales) * 100;
        }
      });
    }

    // Combinar dados e calcular taxa
    const results = Object.keys(productLosses).map(productName => {
      const loss = productLosses[productName];
      const sales = productSales[productName]?.sales || 0;
      const lossRate = sales > 0 ? (loss.loss / sales) * 100 : 0;
      const historicalAvg = historicalAverages[productName] || 0;
      const limit = historicalAvg + 5;
      const isOverLimit = lossRate > limit;

      return {
        name: loss.name,
        loss: loss.loss,
        sales: sales,
        lossRate: lossRate,
        limit: limit,
        isOverLimit: isOverLimit,
        unit: loss.unit
      };
    });

    // Ordenar por taxa de perda (maior para menor)
    return results.sort((a, b) => b.lossRate - a.lossRate);
  }, [salesData, lossData, historicalLossData, productMap]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <CardTitle className="text-lg">Análise de Perdas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Perda</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Taxa de Perda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lossAnalysis.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-right">
                  {item.unit === 'KG' 
                    ? item.loss.toFixed(1) 
                    : item.loss.toLocaleString('pt-BR')} {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  {item.unit === 'KG' 
                    ? item.sales.toFixed(1) 
                    : item.sales.toLocaleString('pt-BR')} {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`font-semibold ${item.isOverLimit ? 'text-red-600' : 'text-green-600'}`}>
                      {item.isOverLimit ? '🔴' : '🟢'} {item.lossRate.toFixed(1)}%
                    </span>
                    <Badge variant="outline" className="text-xs">
                      limite: {item.limit.toFixed(1)}%
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {lossAnalysis.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                  Nenhuma perda registrada nesta semana
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}