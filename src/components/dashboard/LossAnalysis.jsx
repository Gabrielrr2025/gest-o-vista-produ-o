import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

export default function LossAnalysis({ lossData, productMap }) {
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
              <TableHead className="text-right">Percentual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lossData.map((item, idx) => {
              const product = productMap.get(item.product_name);
              const unit = product?.unit === 'kilo' ? 'KG' : 'UN';
              const lossRate = item.sales_quantity > 0 
                ? (item.quantity / item.sales_quantity) * 100 
                : 0;
              const isHighLoss = lossRate > 10;

              return (
                <TableRow 
                  key={idx}
                  className={isHighLoss ? 'bg-red-50' : ''}
                >
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="text-right">
                    <span className={isHighLoss ? 'font-bold text-red-600' : 'text-slate-900'}>
                      {unit === 'KG' 
                        ? item.quantity.toFixed(2) 
                        : Math.round(item.quantity).toLocaleString('pt-BR')} {unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {unit === 'KG' 
                      ? item.sales_quantity.toFixed(2) 
                      : Math.round(item.sales_quantity).toLocaleString('pt-BR')} {unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={isHighLoss ? 'font-bold text-red-600' : 'text-slate-900'}>
                      {lossRate.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {lossData.length === 0 && (
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