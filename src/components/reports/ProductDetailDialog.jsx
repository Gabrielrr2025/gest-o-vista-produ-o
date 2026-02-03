import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import SectorBadge from "../common/SectorBadge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProductDetailDialog({ product, salesRecords, lossRecords, open, onClose }) {
  const detailData = useMemo(() => {
    if (!product) return null;

    const sales = salesRecords.filter(r => r.product_name === product.name);
    const losses = lossRecords.filter(r => r.product_name === product.name);

    // Agrupar por semana
    const weeklyData = {};
    sales.forEach(r => {
      const week = `S${r.week_number}`;
      if (!weeklyData[week]) {
        weeklyData[week] = { week, vendas: 0, perdas: 0, date: r.date };
      }
      weeklyData[week].vendas += r.quantity || 0;
    });
    losses.forEach(r => {
      const week = `S${r.week_number}`;
      if (!weeklyData[week]) {
        weeklyData[week] = { week, vendas: 0, perdas: 0, date: r.date };
      }
      weeklyData[week].perdas += r.quantity || 0;
    });

    const timeline = Object.values(weeklyData)
      .sort((a, b) => parseISO(a.date) - parseISO(b.date))
      .map(w => ({
        ...w,
        total: w.vendas + w.perdas,
        lossRate: w.vendas + w.perdas > 0 ? ((w.perdas / (w.vendas + w.perdas)) * 100).toFixed(1) : 0
      }));

    const totalSales = sales.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalLosses = losses.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const avgSales = timeline.length > 0 ? (totalSales / timeline.length).toFixed(1) : 0;
    const avgLosses = timeline.length > 0 ? (totalLosses / timeline.length).toFixed(1) : 0;
    const overallLossRate = totalSales + totalLosses > 0 ? ((totalLosses / (totalSales + totalLosses)) * 100).toFixed(1) : 0;

    // Tendência (últimas 4 semanas)
    const recent = timeline.slice(-4);
    const trend = recent.length >= 2 ? 
      (recent[recent.length - 1].vendas - recent[0].vendas) / recent[0].vendas * 100 : 0;

    return {
      timeline,
      totalSales,
      totalLosses,
      avgSales,
      avgLosses,
      overallLossRate,
      trend
    };
  }, [product, salesRecords, lossRecords]);

  if (!product || !detailData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl">{product.name}</span>
            <SectorBadge sector={product.sector} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Total Vendas</div>
                <div className="text-2xl font-bold text-blue-600">{detailData.totalSales}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Total Perdas</div>
                <div className="text-2xl font-bold text-red-600">{detailData.totalLosses}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Média Vendas/Sem</div>
                <div className="text-2xl font-bold text-slate-700">{detailData.avgSales}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">% Perda Geral</div>
                <div className={`text-2xl font-bold ${
                  parseFloat(detailData.overallLossRate) > 10 ? "text-red-600" : 
                  parseFloat(detailData.overallLossRate) > 5 ? "text-orange-600" : "text-green-600"
                }`}>
                  {detailData.overallLossRate}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tendência */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {detailData.trend > 0 ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">
                      Crescimento de {Math.abs(detailData.trend).toFixed(1)}% nas últimas semanas
                    </span>
                  </>
                ) : detailData.trend < 0 ? (
                  <>
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-600 font-medium">
                      Queda de {Math.abs(detailData.trend).toFixed(1)}% nas últimas semanas
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-500">Estável</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Evolução */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução Semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailData.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="vendas" stroke="#3b82f6" strokeWidth={2} name="Vendas" />
                    <Line type="monotone" dataKey="perdas" stroke="#ef4444" strokeWidth={2} name="Perdas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Taxa de Perda */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Taxa de Perda por Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={detailData.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="lossRate" fill="#f59e0b" name="% Perda" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}