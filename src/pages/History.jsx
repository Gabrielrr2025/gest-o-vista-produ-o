import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History as HistoryIcon, FileText, Eye, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SectorBadge from "../components/common/SectorBadge";

export default function History() {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list('-created_date')
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list('-created_date')
  });

  const recentImports = [...salesRecords, ...lossRecords]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 50);

  const filteredImports = recentImports.filter(r => 
    r.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewProduct = (productName) => {
    const productSales = salesRecords
      .filter(r => r.product_name === productName)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const productLosses = lossRecords
      .filter(r => r.product_name === productName)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    setSelectedProduct({
      name: productName,
      sector: productSales[0]?.sector || productLosses[0]?.sector,
      sales: productSales,
      losses: productLosses
    });
  };

  const productChartData = selectedProduct ? (() => {
    const grouped = {};
    
    selectedProduct.sales.forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = { date: r.date, vendas: 0, perdas: 0 };
      grouped[r.date].vendas += r.quantity || 0;
    });

    selectedProduct.losses.forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = { date: r.date, vendas: 0, perdas: 0 };
      grouped[r.date].perdas += r.quantity || 0;
    });

    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  })() : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Histórico de Importações</h1>
        <p className="text-sm text-slate-500 mt-1">Visualize todos os dados importados e análises individuais</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <HistoryIcon className="w-5 h-5" />
              Registros Importados
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs">Setor</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs text-right">Quantidade</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Semana</TableHead>
                  <TableHead className="text-xs">Importado em</TableHead>
                  <TableHead className="text-xs text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImports.map((record, index) => {
                  const isSale = !!record.product_name && salesRecords.find(s => s.id === record.id);
                  return (
                    <TableRow key={index} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-sm">{record.product_name}</TableCell>
                      <TableCell><SectorBadge sector={record.sector} /></TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isSale ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isSale ? 'Venda' : 'Perda'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">{record.quantity}</TableCell>
                      <TableCell className="text-sm">
                        {record.date && !isNaN(new Date(record.date)) ? format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">S{record.week_number || '-'}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {record.created_date && !isNaN(new Date(record.created_date)) ? format(new Date(record.created_date), "dd/MM HH:mm", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <button 
                          onClick={() => handleViewProduct(record.product_name)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedProduct?.name}
              {selectedProduct?.sector && <SectorBadge sector={selectedProduct.sector} />}
            </DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Total Vendas</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedProduct.sales.reduce((sum, s) => sum + s.quantity, 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Total Perdas</p>
                    <p className="text-2xl font-bold text-red-600">
                      {selectedProduct.losses.reduce((sum, l) => sum + l.quantity, 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Registros</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {selectedProduct.sales.length + selectedProduct.losses.length}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Evolução Temporal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={productChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          tickFormatter={(val) => format(new Date(val), "dd/MM")}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="vendas" stroke="#3b82f6" name="Vendas" strokeWidth={2} />
                        <Line type="monotone" dataKey="perdas" stroke="#ef4444" name="Perdas" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}