import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function WeekAlerts({ 
  salesData, 
  lossData, 
  historicalLossData, 
  productionData,
  productMap,
  dateRange 
}) {
  const alerts = useMemo(() => {
    const alertsList = [];

    // Calcular médias históricas para alertas de perda
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

    // Agrupar vendas por produto
    const productSales = {};
    salesData.forEach(sale => {
      const key = sale.product_name;
      if (!productSales[key]) {
        const product = productMap.get(sale.product_name);
        productSales[key] = {
          name: sale.product_name,
          sales: 0,
          unit: product?.unit === 'kilo' ? 'kg' : 'un',
          lastSaleDate: sale.date
        };
      }
      productSales[key].sales += sale.quantity || 0;
      if (new Date(sale.date) > new Date(productSales[key].lastSaleDate)) {
        productSales[key].lastSaleDate = sale.date;
      }
    });

    // Agrupar perdas por produto
    const productLosses = {};
    lossData.forEach(loss => {
      const key = loss.product_name;
      if (!productLosses[key]) {
        productLosses[key] = 0;
      }
      productLosses[key] += loss.quantity || 0;
    });

    // Agrupar produção planejada
    const productionPlanned = {};
    productionData.forEach(prod => {
      const key = prod.product_name;
      if (!productionPlanned[key]) {
        productionPlanned[key] = 0;
      }
      productionPlanned[key] += prod.suggested_quantity || 0;
    });

    // 1. ALERTA DE PERDA ALTA 🔴
    Object.keys(productLosses).forEach(productName => {
      const loss = productLosses[productName];
      const sales = productSales[productName]?.sales || 0;
      if (sales > 0) {
        const lossRate = (loss / sales) * 100;
        const historicalAvg = historicalAverages[productName] || 0;
        const limit = historicalAvg + 5;
        
        if (lossRate > limit) {
          alertsList.push({
            type: 'high_loss',
            icon: '🔴',
            text: `${productName}: perda de ${lossRate.toFixed(1)}% (limite: ${limit.toFixed(1)}%)`,
            priority: 1
          });
        }
      }
    });

    // 2. ALERTA DE VENDA BAIXA 🟡
    Object.keys(productionPlanned).forEach(productName => {
      const planned = productionPlanned[productName];
      const sales = productSales[productName]?.sales || 0;
      const unit = productSales[productName]?.unit || productMap.get(productName)?.unit === 'kilo' ? 'kg' : 'un';
      
      if (sales < planned * 0.5) {
        alertsList.push({
          type: 'low_sales',
          icon: '🟡',
          text: `${productName}: vendeu ${sales.toFixed(1)}${unit} (planejado: ${planned.toFixed(1)}${unit})`,
          priority: 2
        });
      }
    });

    // 3. ALERTA DE SEM VENDAS 🟠
    const today = dateRange.to || new Date();
    const fourDaysAgo = new Date(today);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    productMap.forEach((product, productName) => {
      const lastSale = productSales[productName];
      if (!lastSale || new Date(lastSale.lastSaleDate) < fourDaysAgo) {
        const daysSinceLastSale = lastSale 
          ? Math.floor((today - new Date(lastSale.lastSaleDate)) / (1000 * 60 * 60 * 24))
          : 7;
        
        if (daysSinceLastSale >= 4) {
          alertsList.push({
            type: 'no_sales',
            icon: '🟠',
            text: `${productName}: sem vendas há ${daysSinceLastSale} dias`,
            priority: 3
          });
        }
      }
    });

    // 4. ALERTA DE VENDA ALTA 🔵
    Object.keys(productionPlanned).forEach(productName => {
      const planned = productionPlanned[productName];
      const sales = productSales[productName]?.sales || 0;
      const unit = productSales[productName]?.unit || productMap.get(productName)?.unit === 'kilo' ? 'kg' : 'un';
      
      if (sales > planned * 1.3) {
        alertsList.push({
          type: 'high_sales',
          icon: '🔵',
          text: `${productName}: vendeu ${sales.toFixed(1)}${unit} (planejado: ${planned.toFixed(1)}${unit}) - estoque pode faltar`,
          priority: 4
        });
      }
    });

    // Ordenar por prioridade
    return alertsList.sort((a, b) => a.priority - b.priority);
  }, [salesData, lossData, historicalLossData, productionData, productMap, dateRange]);

  // Não mostrar o card se não houver alertas
  if (alerts.length === 0) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-xl">✅</span>
            <span className="font-medium">Nenhum alerta nesta semana</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <CardTitle className="text-lg">Alertas da Semana</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div 
              key={idx} 
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
            >
              <span className="text-xl">{alert.icon}</span>
              <span className="text-sm text-slate-700 flex-1">{alert.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}