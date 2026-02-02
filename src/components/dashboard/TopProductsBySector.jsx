import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectorBadge, { SECTORS } from "../common/SectorBadge";

export default function TopProductsBySector({ salesData, lossData, selectedSector }) {
  const [viewSector, setViewSector] = useState(selectedSector || "Padaria");

  const topProducts = useMemo(() => {
    const products = {};
    
    salesData.filter(r => r.sector === viewSector).forEach(record => {
      const key = record.product_name;
      if (!products[key]) {
        products[key] = { name: key, sector: record.sector, vendas: 0, perdas: 0 };
      }
      products[key].vendas += record.quantity || 0;
    });

    lossData.filter(r => r.sector === viewSector).forEach(record => {
      const key = record.product_name;
      if (!products[key]) {
        products[key] = { name: key, sector: record.sector, vendas: 0, perdas: 0 };
      }
      products[key].perdas += record.quantity || 0;
    });

    return Object.values(products)
      .map(p => ({
        ...p,
        taxaPerda: p.vendas > 0 ? ((p.perdas / p.vendas) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 8);
  }, [salesData, lossData, viewSector]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800">Top 8 Produtos por Setor</CardTitle>
        <Select value={viewSector} onValueChange={setViewSector}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map(sector => (
              <SelectItem key={sector} value={sector}>{sector}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs font-medium">#</TableHead>
              <TableHead className="text-xs font-medium">Produto</TableHead>
              <TableHead className="text-xs font-medium text-right">Vendas</TableHead>
              <TableHead className="text-xs font-medium text-right">Perdas</TableHead>
              <TableHead className="text-xs font-medium text-right">Taxa Perda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProducts.map((product, index) => (
              <TableRow key={index} className="hover:bg-slate-50">
                <TableCell className="font-medium text-slate-500">{index + 1}</TableCell>
                <TableCell className="font-medium text-sm">{product.name}</TableCell>
                <TableCell className="text-right text-sm">{product.vendas.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-right text-sm text-red-600">{product.perdas.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-right">
                  <span className={`text-xs font-medium ${
                    parseFloat(product.taxaPerda) > 15 ? "text-red-600" : 
                    parseFloat(product.taxaPerda) > 8 ? "text-orange-600" : "text-green-600"
                  }`}>
                    {product.taxaPerda}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {topProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  Nenhum dado disponível
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}