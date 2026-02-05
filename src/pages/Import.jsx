import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PDFImporter from "../components/import/PDFImporter";
import SQLImporter from "../components/import/SQLImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, Database, FileUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Import() {
  const [dataSource, setDataSource] = useState('pdf'); // 'pdf' ou 'sql'
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
        <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Importar Dados</h1>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">Importe dados via PDF ou conexão direta com PostgreSQL</p>
      </div>

      <div className="flex gap-2 p-1 bg-[hsl(var(--bg-secondary))] rounded-lg border border-[hsl(var(--border-light))] w-fit">
        <Button
          variant={dataSource === 'pdf' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setDataSource('pdf')}
          className={dataSource === 'pdf' ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : ''}
        >
          <FileUp className="w-4 h-4 mr-2" />
          Importar PDF
        </Button>
        <Button
          variant={dataSource === 'sql' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setDataSource('sql')}
          className={dataSource === 'sql' ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : ''}
        >
          <Database className="w-4 h-4 mr-2" />
          PostgreSQL
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dataSource === 'pdf' ? (
          <PDFImporter products={products} onImportComplete={handleImportComplete} />
        ) : (
          <SQLImporter products={products} onImportComplete={handleImportComplete} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Importações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {recentImports.map((record, index) => (
                <div key={`${record.type}-${record.id}`} className="flex items-center gap-3 p-3 bg-[hsl(var(--bg-secondary))] rounded-lg border border-[hsl(var(--border-light))]">
                  <div className={`p-2 rounded-lg ${
                    record.type === 'venda' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    <FileText className={`w-4 h-4 ${
                      record.type === 'venda' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--text-primary))] truncate">{record.product_name}</p>
                    <p className="text-xs text-[hsl(var(--text-tertiary))] truncate">
                      {record.sector} • {record.quantity} unidades • {record.type}
                    </p>
                  </div>
                  <div className="text-xs text-[hsl(var(--text-tertiary))] whitespace-nowrap">
                    {format(new Date(record.created_date), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
              {recentImports.length === 0 && (
                <div className="text-center py-8 text-[hsl(var(--text-tertiary))]">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma importação recente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900/50">
        <CardContent className="p-5">
          <h4 className="font-semibold text-[hsl(var(--text-primary))] mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Como funciona a importação:
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[hsl(var(--text-secondary))]">
            <li>Faça upload do PDF exportado do ERP Lince (relatório de vendas ou perdas)</li>
            <li>O sistema identifica automaticamente o tipo de relatório e extrai os dados</li>
            <li>Produtos novos podem ser cadastrados automaticamente (modo PDF)</li>
            <li>Os dados são integrados aos dashboards e relatórios em tempo real</li>
            <li>Escolha entre PDF (análise local) ou PostgreSQL (conexão direta com view SQL)</li>
            <li className="font-medium text-cyan-700 dark:text-cyan-300">💡 A importação continua mesmo se você navegar para outra aba</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}