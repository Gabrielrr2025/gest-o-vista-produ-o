import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart2, CheckCircle, XCircle, AlertCircle, Loader2, TrendingUp } from "lucide-react";

export default function PlanningDiagnostic() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('Debugplanning', {});
      setResult(response.data || response);
    } catch (error) {
      setResult({ erro: error.message || 'Erro desconhecido' });
    } finally {
      setIsRunning(false);
    }
  };

  const d = result?.diagnostico_planejamento;

  const temDadosNoPeriodo = d && parseInt(d.dados_nas_ultimas_8_semanas?.vendas?.registros || 0) > 0;
  const joinOk = d?.amostra_join_produto_id?.every(r => r.join_ok);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-purple-600" />
          <CardTitle>Diagnóstico do Planejamento</CardTitle>
        </div>
        <CardDescription>
          Verifica se os dados históricos de vendas estão disponíveis para gerar médias e sugestões no planejamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runDiagnostic}
          disabled={isRunning}
          variant="outline"
          className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analisando dados...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4 mr-2" />
              Verificar Dados do Planejamento
            </>
          )}
        </Button>

        {result?.erro && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Erro ao executar diagnóstico
            </p>
            <p className="text-xs text-red-600 mt-1">{result.erro}</p>
          </div>
        )}

        {d && (
          <div className="space-y-4">
            {/* Status Geral */}
            <div className={`p-3 rounded-lg border flex items-start gap-3 ${temDadosNoPeriodo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {temDadosNoPeriodo
                ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                : <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              }
              <div>
                <p className={`text-sm font-semibold ${temDadosNoPeriodo ? 'text-green-800' : 'text-red-800'}`}>
                  {temDadosNoPeriodo
                    ? '✅ Dados históricos encontrados — o planejamento deve mostrar médias e sugestões.'
                    : '❌ Sem dados históricos nas últimas 8 semanas — o planejamento vai mostrar "0 UN" e sugestão padrão.'}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  Período analisado: {d.periodo_historico.de} até {d.periodo_historico.ate}
                </p>
              </div>
            </div>

            {/* Totais Gerais */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-xs text-slate-500 mb-1">Produtos Ativos</p>
                <p className="text-2xl font-bold text-slate-800">{d.totais_gerais.produtos_ativos}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-blue-500 mb-1">Total Vendas (banco)</p>
                <p className="text-2xl font-bold text-blue-800">{d.totais_gerais.vendas.total_registros}</p>
                {d.totais_gerais.vendas.mais_recente && (
                  <p className="text-xs text-blue-400 mt-1">Última: {String(d.totais_gerais.vendas.mais_recente).split('T')[0]}</p>
                )}
              </div>
              <div className="p-3 bg-orange-50 rounded-lg text-center">
                <p className="text-xs text-orange-500 mb-1">Total Perdas (banco)</p>
                <p className="text-2xl font-bold text-orange-800">{d.totais_gerais.perdas.total_registros}</p>
                {d.totais_gerais.perdas.mais_recente && (
                  <p className="text-xs text-orange-400 mt-1">Última: {String(d.totais_gerais.perdas.mais_recente).split('T')[0]}</p>
                )}
              </div>
            </div>

            {/* Dados nas Últimas 8 Semanas */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Nas Últimas 8 Semanas (janela do planejamento)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-3 rounded-lg border ${parseInt(d.dados_nas_ultimas_8_semanas.vendas.registros || 0) > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-xs text-slate-600">Registros de Vendas</p>
                  <p className="text-xl font-bold mt-1">{d.dados_nas_ultimas_8_semanas.vendas.registros}</p>
                  <p className="text-xs text-slate-500">Qtd total: {d.dados_nas_ultimas_8_semanas.vendas.quantidade_total || 0}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-600">Registros de Perdas</p>
                  <p className="text-xl font-bold mt-1">{d.dados_nas_ultimas_8_semanas.perdas.registros}</p>
                  <p className="text-xs text-slate-500">Qtd total: {d.dados_nas_ultimas_8_semanas.perdas.quantidade_total || 0}</p>
                </div>
              </div>
            </div>

            {/* JOIN OK? */}
            <div className={`p-3 rounded-lg border ${joinOk ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                {joinOk
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <AlertCircle className="w-4 h-4 text-yellow-600" />
                }
                Relação vendas ↔ produtos (JOIN)
              </p>
              <div className="space-y-1">
                {d.amostra_join_produto_id.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">View: <code className="bg-slate-100 px-1 rounded">{r.nome_na_view}</code> → Tabela: <code className="bg-slate-100 px-1 rounded">{r.nome_na_tabela || '❌ não encontrado'}</code></span>
                    <Badge variant={r.join_ok ? 'outline' : 'destructive'} className="text-xs">
                      {r.join_ok ? '✅ ID: ' + r.produto_id_encontrado : '❌ sem match'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 produtos com vendas */}
            {d.top5_produtos_com_vendas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Top 5 Produtos com Vendas no Período</p>
                <div className="space-y-1">
                  {d.top5_produtos_com_vendas.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                      <span className="font-medium">{p.nome}</span>
                      <span className="text-slate-500">{p.setor}</span>
                      <span className="font-bold text-blue-700">{p.soma_vendas} un</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Produtos sem vendas */}
            {d.produtos_sem_vendas_no_periodo.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                  ⚠️ Produtos sem vendas nas últimas 8 semanas (mostrarão "0 UN")
                </p>
                <div className="flex flex-wrap gap-1">
                  {d.produtos_sem_vendas_no_periodo.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs border-orange-300 text-orange-700">
                      {p.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Vendas por semana */}
            {d.vendas_por_semana.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Vendas por Semana (histórico)</p>
                <div className="space-y-1">
                  {d.vendas_por_semana.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded">
                      <span className="text-slate-600">{String(s.semana).split('T')[0]}</span>
                      <span className="font-medium">{s.registros} registros</span>
                      <span className="text-blue-700 font-bold">{Number(s.total_qtd).toFixed(0)} un</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
