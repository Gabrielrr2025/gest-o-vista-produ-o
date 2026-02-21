import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

export default function DatabaseDiagnostic() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('diagnosticDB', {});
      setResult(response.data || response);
    } catch (error) {
      console.error('❌ Erro ao executar diagnóstico:', error);
      setResult({
        success: false,
        steps: [
          {
            step: 'error',
            status: 'failed',
            error: error.message || 'Erro desconhecido'
          }
        ]
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <CardTitle>Diagnóstico do Banco de Dados</CardTitle>
        </div>
        <CardDescription>
          Verifica a conexão com o banco PostgreSQL e a estrutura da tabela produtos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostic} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Executando diagnóstico...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Executar Diagnóstico
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-800">Diagnóstico Completo</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-800">Problemas Encontrados</span>
                  </>
                )}
              </AlertTitle>
              <AlertDescription className="text-sm mt-2">
                {result.timestamp && (
                  <span className="text-slate-600">
                    Executado em: {new Date(result.timestamp).toLocaleString('pt-BR')}
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-slate-700">Passos do Diagnóstico:</h4>
              {result.steps?.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getStepColor(step.status)}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getStepIcon(step.status)}
                    <span className="font-medium text-sm capitalize">
                      {step.step.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  {step.error && (
                    <p className="text-sm text-red-700 ml-6">
                      ❌ {step.error}
                    </p>
                  )}
                  
                  {step.message && (
                    <p className="text-sm text-slate-700 ml-6">
                      ℹ️ {step.message}
                    </p>
                  )}
                  
                  {step.count !== undefined && (
                    <p className="text-sm text-slate-700 ml-6">
                      📊 Total de produtos: {step.count}
                    </p>
                  )}
                  
                  {step.columns && (
                    <div className="ml-6 mt-2">
                      <p className="text-sm font-medium text-slate-700 mb-1">Estrutura da tabela:</p>
                      <div className="text-xs space-y-1 font-mono bg-white p-2 rounded border border-slate-200">
                        {step.columns.map((col, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-blue-600">{col.name}</span>
                            <span className="text-slate-400">-</span>
                            <span className="text-green-600">{col.type}</span>
                            {col.nullable === 'NO' && (
                              <span className="text-red-600">NOT NULL</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!result.success && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Próximos Passos</AlertTitle>
                <AlertDescription className="text-sm text-yellow-700 mt-2 space-y-2">
                  <p>Para resolver os problemas encontrados:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Verifique se a variável POSTGRES_CONNECTION_URL está configurada nas variáveis de ambiente</li>
                    <li>Execute o script SQL create_produtos_table.sql no seu banco Neon PostgreSQL</li>
                    <li>Execute o diagnóstico novamente para confirmar</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
