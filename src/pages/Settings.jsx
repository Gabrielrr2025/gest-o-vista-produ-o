import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState({
    increase_threshold: 10,
    decrease_threshold: -10,
    min_history_weeks: 3,
    calendar_impact_enabled: true
  });

  const { data: systemConfig = [] } = useQuery({
    queryKey: ['systemConfig'],
    queryFn: () => base44.entities.SystemConfig.list()
  });

  useEffect(() => {
    const savedConfig = systemConfig.find(c => c.config_key === "suggestion_engine");
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig.config_value));
      } catch (e) {
        console.error("Error parsing config", e);
      }
    }
  }, [systemConfig]);

  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig) => {
      const existing = systemConfig.find(c => c.config_key === "suggestion_engine");
      const data = {
        config_key: "suggestion_engine",
        config_value: JSON.stringify(newConfig),
        description: "Configurações do motor de sugestão de produção"
      };

      if (existing) {
        return base44.entities.SystemConfig.update(existing.id, data);
      } else {
        return base44.entities.SystemConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
      toast.success("Configurações salvas");
    }
  });

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">Ajuste o motor de sugestão de produção</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Motor de Sugestão
          </CardTitle>
          <CardDescription>
            Configure como o sistema calcula as sugestões de produção
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Limite de Aumento (%)</Label>
            <Input
              type="number"
              value={config.increase_threshold}
              onChange={(e) => setConfig({ ...config, increase_threshold: parseFloat(e.target.value) })}
              min="0"
              step="1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Percentual máximo de aumento automático na produção quando vendas sobem e perdas caem
            </p>
          </div>

          <div>
            <Label>Limite de Redução (%)</Label>
            <Input
              type="number"
              value={config.decrease_threshold}
              onChange={(e) => setConfig({ ...config, decrease_threshold: parseFloat(e.target.value) })}
              max="0"
              step="1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Percentual máximo de redução automática na produção quando perdas sobem e vendas caem
            </p>
          </div>

          <div>
            <Label>Semanas de Histórico Mínimo</Label>
            <Input
              type="number"
              value={config.min_history_weeks}
              onChange={(e) => setConfig({ ...config, min_history_weeks: parseInt(e.target.value) })}
              min="1"
              max="12"
            />
            <p className="text-xs text-slate-500 mt-1">
              Número mínimo de semanas necessárias para calcular a média histórica
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
              <Save className="w-4 h-4 mr-1" />
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-900 mb-2">Como funciona o motor de sugestão:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Calcula média de vendas e perdas das últimas semanas</li>
            <li>Analisa tendência: se perdas aumentam e vendas caem → reduz produção</li>
            <li>Se vendas aumentam e perdas caem → aumenta produção</li>
            <li>Considera eventos do calendário com impacto configurado</li>
            <li>Aplica rendimento da receita para calcular unidades de produção</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}