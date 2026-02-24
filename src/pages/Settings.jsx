import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon,
  Lock,
  Save,
  Eye,
  EyeOff,
  Shield,
  Info
} from "lucide-react";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import DatabaseDiagnostic from "@/components/settings/DatabaseDiagnostic";
import PlanningDiagnostic from "@/components/settings/PlanningDiagnostic";
import ProductionRationalSettings from "@/components/settings/ProductionRationalSettings";

export default function Settings() {
  const queryClient = useQueryClient();
  
  // Estados locais
  const [editCode, setEditCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Buscar usuário atual
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return user;
    }
  });

  const isAdmin = currentUser?.role === 'admin';

  // Buscar configuração atual
  const { data: configData, isLoading } = useQuery({
    queryKey: ['config', 'codigo_edicao_planejamento'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getConfig', {
        chave: 'codigo_edicao_planejamento'
      });
      return response.data;
    },
    onSuccess: (data) => {
      setEditCode(data?.valor || '1234');
    }
  });

  // Mutation para salvar configuração
  const saveMutation = useMutation({
    mutationFn: async (newCode) => {
      const response = await base44.functions.invoke('saveConfig', {
        chave: 'codigo_edicao_planejamento',
        valor: newCode
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['config']);
      setIsEditing(false);
      toast.success("✅ Código de edição atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("❌ Erro ao salvar código: " + error.message);
    }
  });

  const handleSave = () => {
    if (!editCode || editCode.trim().length < 4) {
      toast.error("O código deve ter no mínimo 4 caracteres");
      return;
    }

    saveMutation.mutate(editCode.trim());
  };

  const handleCancel = () => {
    setEditCode(configData?.valor || '1234');
    setIsEditing(false);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
          <p className="text-sm text-slate-500 mt-1">
            Personalize o sistema
          </p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar as configurações do sistema.
            Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie as configurações do sistema
        </p>
      </div>

      {/* Informações do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-600" />
            Informações da Conta
          </CardTitle>
          <CardDescription>
            Suas informações de acesso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-slate-600">Nome</Label>
              <p className="font-medium text-slate-900 mt-1">
                {currentUser?.full_name || 'Não informado'}
              </p>
            </div>
            <div>
              <Label className="text-sm text-slate-600">Email</Label>
              <p className="font-medium text-slate-900 mt-1">
                {currentUser?.email || 'Não informado'}
              </p>
            </div>
            <div>
              <Label className="text-sm text-slate-600">Perfil</Label>
              <p className="font-medium text-slate-900 mt-1">
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                  {currentUser?.role === 'admin' ? 'Administrador' : 'Usuário'}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Diagnóstico do Banco de Dados */}
      <DatabaseDiagnostic />

      <Separator />

      {/* Diagnóstico do Planejamento */}
      <PlanningDiagnostic />

      <Separator />

      {/* Configuração do Código de Edição */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            Código de Edição do Planejamento
          </CardTitle>
          <CardDescription>
            Código necessário para editar planejamentos de semanas passadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Explicação */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este código é solicitado quando um usuário tenta editar o planejamento 
              de uma semana que já passou. Isso garante que apenas pessoas autorizadas 
              possam fazer alterações em dados históricos.
            </AlertDescription>
          </Alert>

          {/* Campo de Código */}
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="edit-code">Código Atual</Label>
                <div className="relative mt-1">
                  <Input
                    id="edit-code"
                    type={showCode ? "text" : "password"}
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    disabled={!isEditing || isLoading || saveMutation.isLoading}
                    className="pr-10"
                    placeholder="Digite o código (mín. 4 caracteres)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? (
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Código atual: {configData?.valor ? '••••' : 'Não configurado'}
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                Alterar Código
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isLoading ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  disabled={saveMutation.isLoading}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* Histórico de atualizações */}
          {configData?.updated_at && (
            <div className="pt-3 border-t">
              <p className="text-xs text-slate-500">
                Última atualização: {new Date(configData.updated_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Racional de Produção */}
      <ProductionRationalSettings isAdmin={isAdmin} />

      {/* Sobre o Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sobre o Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Versão:</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Sistema:</span>
            <span className="font-medium">Gestão à Vista - Produção</span>
          </div>
          <div className="flex justify-between">
            <span>Desenvolvido por:</span>
            <span className="font-medium">Base44</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
