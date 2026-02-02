import React from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PDFImporter from "../components/import/PDFImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Import() {
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list('-created_date', 10)
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list('-created_date', 10)
  });

  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['salesRecords'] });
    queryClient.invalidateQueries({ queryKey: ['lossRecords'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const recentImports = [
    ...salesRecords.map(r => ({ ...r, type: 'venda' })),
    ...lossRecords.map(r => ({ ...r, type: 'perda' }))
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar Dados</h1>
        <p className="text-sm text-slate-500 mt-1">Importe PDFs do ERP Lince para alimentar o sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PDFImporter products={products} onImportComplete={handleImportComplete} />

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Importações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {recentImports.map((record, index) => (
                <div key={`${record.type}-${record.id}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    record.type === 'venda' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <FileText className={`w-4 h-4 ${
                      record.type === 'venda' ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{record.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {record.sector} • {record.quantity} unidades • {record.type}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {format(new Date(record.created_date), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
              {recentImports.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma importação recente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-900 mb-2">Como funciona a importação:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Faça upload do PDF exportado do ERP Lince (relatório de vendas ou perdas)</li>
            <li>O sistema identifica automaticamente o tipo de relatório e extrai os dados</li>
            <li>Produtos novos podem ser cadastrados automaticamente</li>
            <li>Os dados são integrados aos dashboards e relatórios em tempo real</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}