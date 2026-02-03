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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            {product.name}
            <SectorBadge sector={product.sector} />
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-2">
            Análise completa do desempenho do produto
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-5">
                <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total Vendas</div>
                <div className="text-3xl font-bold text-blue-900 mt-2">{detailData.totalSales.toLocaleString('pt-BR')}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="p-5">
                <div className="text-xs font-medium text-red-700 uppercase tracking-wide">Total Perdas</div>
                <div className="text-3xl font-bold text-red-900 mt-2">{detailData.totalLosses.toLocaleString('pt-BR')}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-5">
                <div className="text-xs font-medium text-slate-700 uppercase tracking-wide">Média Semanal</div>
                <div className="text-3xl font-bold text-slate-900 mt-2">{detailData.avgSales}</div>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br border-2 ${
              parseFloat(detailData.overallLossRate) > 10 ? "from-red-50 to-red-100 border-red-300" : 
              parseFloat(detailData.overallLossRate) > 5 ? "from-orange-50 to-orange-100 border-orange-300" : 
              "from-green-50 to-green-100 border-green-300"
            }`}>
              <CardContent className="p-5">
                <div className={`text-xs font-medium uppercase tracking-wide ${
                  parseFloat(detailData.overallLossRate) > 10 ? "text-red-700" : 
                  parseFloat(detailData.overallLossRate) > 5 ? "text-orange-700" : "text-green-700"
                }`}>% Perda Geral</div>
                <div className={`text-3xl font-bold mt-2 ${
                  parseFloat(detailData.overallLossRate) > 10 ? "text-red-900" : 
                  parseFloat(detailData.overallLossRate) > 5 ? "text-orange-900" : "text-green-900"
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
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">Evolução Semanal</CardTitle>
              <p className="text-xs text-slate-600 mt-1">Acompanhe a tendência de vendas e perdas ao longo do tempo</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailData.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="vendas" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      name="Vendas"
                      dot={{ fill: '#3b82f6', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="perdas" 
                      stroke="#ef4444" 
                      strokeWidth={3} 
                      name="Perdas"
                      dot={{ fill: '#ef4444', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Taxa de Perda */}
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100">
              <CardTitle className="text-lg font-bold text-slate-900">Taxa de Perda por Semana</CardTitle>
              <p className="text-xs text-slate-600 mt-1">Percentual de perdas em relação ao total (vendas + perdas)</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={detailData.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} unit="%" />
                    <Tooltip 
                      formatter={(value) => `${value}%`}
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="lossRate" 
                      fill="#f59e0b" 
                      name="% Perda" 
                      radius={[8, 8, 0, 0]}
                    />
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