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
  const [result, setResult] = useState(null);



  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-600" />
          Sincronização Automática SQL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-900/50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Importação Automática Ativa
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Os dados do PostgreSQL são sincronizados automaticamente ao abrir Dashboard, Relatórios e Planejamento.
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1 ml-4 list-disc">
                <li>Cache inteligente de 5 minutos</li>
                <li>Sincroniza apenas registros novos</li>
                <li>Período padrão: últimos 30 dias</li>
                <li>Respeita filtros de data das telas</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-[hsl(var(--bg-secondary))] rounded-lg p-3 border border-[hsl(var(--border-light))]">
          <p className="text-xs text-[hsl(var(--text-tertiary))] leading-relaxed">
            <strong>Fonte:</strong> View vw_movimentacoes (PostgreSQL)<br/>
            <strong>Modo:</strong> Automático (leitura contínua)<br/>
            <strong>Campos:</strong> data, semana, mes, produto, setor, quantidade, valor, tipo<br/>
            <strong>Status:</strong> ✅ Ativo
          </p>
        </div>
      </CardContent>
    </Card>
  );
}