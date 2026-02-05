import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SQLImporter({ products, onImportComplete }) {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecione o período de importação');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Buscar dados do PostgreSQL
      const response = await base44.functions.invoke('fetchSQLData', {
        startDate,
        endDate
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao buscar dados');
      }

      const { salesData, lossData, totalRecords } = response.data;

      // Mapear produtos existentes
      const productMap = new Map(products.map(p => [p.name.toLowerCase(), p]));

      let salesImported = 0;
      let lossImported = 0;

      // Importar vendas
      for (const sale of salesData) {
        const product = productMap.get(sale.product_name.toLowerCase());
        
        const saleRecord = {
          product_id: product?.id || null,
          product_name: sale.product_name,
          sector: sale.sector,
          quantity: sale.quantity,
          date: sale.date,
          week_number: sale.week_number,
          month: sale.month,
          year: sale.year
        };

        await base44.entities.SalesRecord.create(saleRecord);
        salesImported++;
      }

      // Importar perdas
      for (const loss of lossData) {
        const product = productMap.get(loss.product_name.toLowerCase());
        
        const lossRecord = {
          product_id: product?.id || null,
          product_name: loss.product_name,
          sector: loss.sector,
          quantity: loss.quantity,
          date: loss.date,
          week_number: loss.week_number,
          month: loss.month,
          year: loss.year
        };

        await base44.entities.LossRecord.create(lossRecord);
        lossImported++;
      }

      setResult({
        success: true,
        salesImported,
        lossImported,
        totalRecords
      });

      toast.success(`Importação concluída: ${salesImported} vendas e ${lossImported} perdas`);
      onImportComplete();

    } catch (error) {
      console.error('Erro na importação SQL:', error);
      setResult({
        success: false,
        error: error.message
      });
      toast.error('Erro ao importar dados do banco de dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-600" />
          Importar do PostgreSQL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Data Inicial</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Data Final</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <Button
          onClick={handleImport}
          disabled={loading || !startDate || !endDate}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Importar Dados SQL
            </>
          )}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success 
              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50' 
              : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50'
          }`}>
            {result.success ? (
              <>
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-medium mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Importação Concluída
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>• {result.salesImported} registros de vendas</p>
                  <p>• {result.lossImported} registros de perdas</p>
                  <p>• Total: {result.totalRecords} registros processados</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200 font-medium mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Erro na Importação
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
              </>
            )}
          </div>
        )}

        <div className="bg-[hsl(var(--bg-secondary))] rounded-lg p-3 border border-[hsl(var(--border-light))]">
          <p className="text-xs text-[hsl(var(--text-tertiary))] leading-relaxed">
            <strong>Fonte:</strong> View vw_movimentacoes (PostgreSQL)<br/>
            <strong>Modo:</strong> Somente leitura<br/>
            <strong>Campos:</strong> data, semana, mes, produto, setor, quantidade, valor, tipo
          </p>
        </div>
      </CardContent>
    </Card>
  );
}