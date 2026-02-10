import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";

export default function SummaryTable({ data, products }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Criar mapa de preços dos produtos
  const priceMap = {};
  products.forEach(product => {
    priceMap[product.id] = product.price || 0;
  });

  // Verificar se há produtos com preço
  const hasPrice = Object.values(priceMap).some(price => price > 0);

  // Função de ordenação
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Ordenar dados
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    if (sortConfig.key === 'period') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (sortConfig.key === 'rate') {
      aValue = a.sales > 0 ? (a.losses / a.sales) * 100 : 0;
      bValue = b.sales > 0 ? (b.losses / b.sales) * 100 : 0;
    }

    return sortConfig.direction === 'asc' 
      ? aValue - bValue
      : bValue - aValue;
  });

  // Calcular totais
  const totals = data.reduce((acc, item) => ({
    sales: acc.sales + (item.sales || 0),
    losses: acc.losses + (item.losses || 0),
    revenue: acc.revenue + (item.revenue || 0)
  }), { sales: 0, losses: 0, revenue: 0 });

  const totalRate = totals.sales > 0 ? (totals.losses / totals.sales) * 100 : 0;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const SortButton = ({ columnKey, children }) => (
    <button
      onClick={() => handleSort(columnKey)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      {children}
      <ArrowUpDown className="w-4 h-4" />
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resumo Detalhado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-700 hover:bg-slate-700">
                <TableHead className="text-white font-semibold">
                  <SortButton columnKey="period">Período</SortButton>
                </TableHead>
                <TableHead className="text-white font-semibold text-right">
                  <SortButton columnKey="sales">Vendas</SortButton>
                </TableHead>
                <TableHead className="text-white font-semibold text-right">
                  <SortButton columnKey="losses">Perdas</SortButton>
                </TableHead>
                <TableHead className="text-white font-semibold text-right">
                  <SortButton columnKey="rate">Taxa Perda</SortButton>
                </TableHead>
                {hasPrice && (
                  <TableHead className="text-white font-semibold text-right">
                    <SortButton columnKey="revenue">Faturamento</SortButton>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row, index) => {
                const rate = row.sales > 0 ? (row.losses / row.sales) * 100 : 0;
                return (
                  <TableRow 
                    key={index}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  >
                    <TableCell className="font-medium">{row.periodLabel || row.period}</TableCell>
                    <TableCell className="text-right">{row.sales.toFixed(2)} KG</TableCell>
                    <TableCell className="text-right">{row.losses.toFixed(2)} KG</TableCell>
                    <TableCell className="text-right">{rate.toFixed(1)}%</TableCell>
                    {hasPrice && (
                      <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                    )}
                  </TableRow>
                );
              })}
              
              {/* Linha de Total */}
              <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <TableCell className="font-bold">TOTAL</TableCell>
                <TableCell className="text-right font-bold">{totals.sales.toFixed(2)} KG</TableCell>
                <TableCell className="text-right font-bold">{totals.losses.toFixed(2)} KG</TableCell>
                <TableCell className="text-right font-bold">{totalRate.toFixed(1)}%</TableCell>
                {hasPrice && (
                  <TableCell className="text-right font-bold">{formatCurrency(totals.revenue)}</TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
