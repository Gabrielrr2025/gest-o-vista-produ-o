import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save, Sparkles, Building2, Bell, Calendar, Eye, Shield, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import DataReset from "../components/settings/DataReset";

export default function Settings() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeSection, setActiveSection] = useState('company');

  // Verificar permissão de acesso (apenas MASTER)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        
        // Apenas MASTER (admin) tem acesso
        if (user.role === 'admin') {
          setCurrentUser(user);
          setHasAccess(true);
        } else {
          toast.error("Apenas administradores podem acessar Configurações");
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } catch (error) {
        window.location.href = '/';
      }
    };
    checkAuth();
  }, []);

  const handleResetComplete = () => {
    queryClient.invalidateQueries();
  };
  
  const [config, setConfig] = useState({
    increase_threshold: 10,
    decrease_threshold: -10,
    min_history_weeks: 3,
    calendar_impact_enabled: true
  });

  const [companyData, setCompanyData] = useState({
    logo_url: '',
    company_name: '',
    cnpj: '',
    address: '',
    city: 'Itaperuna',
    state: 'RJ',
    phone: '',
    email: ''
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);

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

    const savedCompanyData = systemConfig.find(c => c.config_key === "company_data");
    if (savedCompanyData) {
      try {
        setCompanyData(JSON.parse(savedCompanyData.config_value));
      } catch (e) {
        console.error("Error parsing company data", e);
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
    toast.success("✓ Configurações salvas");
  };

  const saveCompanyDataMutation = useMutation({
    mutationFn: async (data) => {
      const existing = systemConfig.find(c => c.config_key === "company_data");
      const payload = {
        config_key: "company_data",
        config_value: JSON.stringify(data),
        description: "Dados da empresa para relatórios"
      };

      if (existing) {
        return base44.entities.SystemConfig.update(existing.id, payload);
      } else {
        return base44.entities.SystemConfig.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
      toast.success("✓ Dados da empresa salvos");
    }
  });

  const handleSaveCompanyData = () => {
    saveCompanyDataMutation.mutate(companyData);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB");
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error("Formato inválido. Use PNG ou JPG");
      return;
    }

    try {
      setUploadingLogo(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCompanyData({ ...companyData, logo_url: file_url });
      toast.success("Logo enviada com sucesso");
    } catch (error) {
      toast.error("Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setCompanyData({ ...companyData, logo_url: '' });
  };

  const formatCNPJ = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatPhone = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 14);
    } else {
      return cleaned
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .slice(0, 15);
    }
  };

  const brazilianStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const sections = [
    { id: 'company', name: 'Dados da Empresa', icon: Building2 },
    { id: 'alerts', name: 'Limites e Alertas', icon: Bell },
    { id: 'planning', name: 'Planejamento', icon: Calendar },
    { id: 'display', name: 'Preferências de Exibição', icon: Eye },
    { id: 'security', name: 'Backup e Segurança', icon: Shield }
  ];

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <div className="text-slate-500">Verificando permissões...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-slate-600" />
          Configurações
        </h1>
        <p className="text-sm text-slate-500 mt-1">Parâmetros do sistema e preferências</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* MENU LATERAL */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${activeSection === section.id
                        ? 'bg-[#F59E0B] text-white shadow-md'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-secondary))] hover:text-[hsl(var(--text-primary))]'
                      }
                    `}
                  >
                    <section.icon className="w-5 h-5" />
                    {section.name}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* ÁREA PRINCIPAL */}
        <div className="lg:col-span-3 space-y-6">

          {/* SEÇÃO: DADOS DA EMPRESA */}
          {activeSection === 'company' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados da Empresa</CardTitle>
                <CardDescription>Informações que aparecem nos relatórios e documentos exportados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* LOGO DA EMPRESA */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Logo da Empresa</Label>
                  <div className="space-y-3">
                    {companyData.logo_url ? (
                      <div className="flex items-start gap-4">
                        <div className="w-[300px] h-[100px] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden">
                          <img 
                            src={companyData.logo_url} 
                            alt="Logo da empresa" 
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleRemoveLogo}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remover Logo
                        </Button>
                      </div>
                    ) : (
                      <div className="w-[300px] h-[100px] border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:border-slate-400 transition-colors relative">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleLogoUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploadingLogo}
                        />
                        {uploadingLogo ? (
                          <div className="text-sm text-slate-500">Enviando...</div>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                            <div className="text-sm text-slate-500">Clique para fazer upload</div>
                          </>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      Formatos aceitos: PNG, JPG (até 2MB) • Dimensões recomendadas: 300x100px
                    </p>
                  </div>
                </div>

                {/* NOME DA EMPRESA */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    Nome da Empresa <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    placeholder="Ex: Panificadora São José"
                    value={companyData.company_name}
                    onChange={(e) => setCompanyData({...companyData, company_name: e.target.value})}
                  />
                </div>

                {/* CNPJ */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">CNPJ</Label>
                  <Input 
                    placeholder="00.000.000/0000-00"
                    value={companyData.cnpj}
                    onChange={(e) => setCompanyData({...companyData, cnpj: formatCNPJ(e.target.value)})}
                    maxLength={18}
                  />
                </div>

                {/* ENDEREÇO */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Endereço</Label>
                  <Input 
                    placeholder="Ex: Rua Principal, 123 - Centro"
                    value={companyData.address}
                    onChange={(e) => setCompanyData({...companyData, address: e.target.value})}
                  />
                </div>

                {/* CIDADE/ESTADO */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Cidade</Label>
                    <Input 
                      placeholder="Cidade"
                      value={companyData.city}
                      onChange={(e) => setCompanyData({...companyData, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Estado</Label>
                    <Select 
                      value={companyData.state} 
                      onValueChange={(value) => setCompanyData({...companyData, state: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map(state => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* TELEFONE */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Telefone</Label>
                  <Input 
                    placeholder="(00) 00000-0000"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({...companyData, phone: formatPhone(e.target.value)})}
                    maxLength={15}
                  />
                </div>

                {/* EMAIL */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Email</Label>
                  <Input 
                    type="email"
                    placeholder="contato@empresa.com"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({...companyData, email: e.target.value})}
                  />
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleSaveCompanyData}
                    disabled={saveCompanyDataMutation.isPending || !companyData.company_name}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Dados da Empresa
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEÇÃO: LIMITES E ALERTAS */}
          {activeSection === 'alerts' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Motor de Sugestão
                </CardTitle>
                <CardDescription>Configure como o sistema calcula as sugestões de produção</CardDescription>
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

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Como funciona:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                      <li>Calcula média de vendas e perdas das últimas semanas</li>
                      <li>Analisa tendência: se perdas aumentam e vendas caem → reduz produção</li>
                      <li>Se vendas aumentam e perdas caem → aumenta produção</li>
                      <li>Considera eventos do calendário com impacto configurado</li>
                      <li>Aplica rendimento da receita para calcular unidades de produção</li>
                    </ol>
                  </CardContent>
                </Card>

                <div className="pt-4 border-t">
                  <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEÇÃO: PLANEJAMENTO */}
          {activeSection === 'planning' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Planejamento</CardTitle>
                <CardDescription>Configurações de planejamento de produção</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Semanas de Antecedência</Label>
                  <Input type="number" defaultValue="2" min="1" max="8" />
                  <p className="text-xs text-slate-500 mt-1">
                    Quantas semanas futuras exibir no planejamento
                  </p>
                </div>
                <div>
                  <Label>Auto-save</Label>
                  <Input type="number" defaultValue="30" min="10" max="120" />
                  <p className="text-xs text-slate-500 mt-1">
                    Salvar automaticamente a cada X segundos (após edição)
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEÇÃO: PREFERÊNCIAS DE EXIBIÇÃO */}
          {activeSection === 'display' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preferências de Exibição</CardTitle>
                <CardDescription>Personalize a aparência do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Formato de Data</Label>
                  <Input defaultValue="DD/MM/YYYY" disabled />
                  <p className="text-xs text-slate-500 mt-1">
                    Formato padrão para exibição de datas
                  </p>
                </div>
                <div>
                  <Label>Unidade Padrão</Label>
                  <Input defaultValue="KG" disabled />
                  <p className="text-xs text-slate-500 mt-1">
                    Unidade de medida principal
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEÇÃO: BACKUP E SEGURANÇA */}
          {activeSection === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Backup e Segurança</CardTitle>
                <CardDescription>Gerenciamento de dados e segurança</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <DataReset onComplete={handleResetComplete} />
                
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Informações do Sistema</h4>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>Versão: 1.0.0</p>
                    <p>Última atualização: 07/02/2026</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}