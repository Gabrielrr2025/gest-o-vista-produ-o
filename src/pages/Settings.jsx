import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save, Sparkles, Building2, Bell, Calendar, Eye, Shield, Upload, X, Image as ImageIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

  const [alertSettings, setAlertSettings] = useState({
    loss_calc_type: 'average_plus', // 'fixed' ou 'average_plus'
    loss_fixed_percent: 10,
    loss_average_plus: 5,
    low_sales_percent: 50,
    no_sales_days: 4,
    high_sales_enabled: false,
    high_sales_percent: 130
  });

  const [planningSettings, setPlanningSettings] = useState({
    calculation_weeks: 4,
    safety_margin: 10,
    holiday_impact: 30,
    event_impact: 30,
    auto_fill_enabled: true
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

    const savedAlertSettings = systemConfig.find(c => c.config_key === "alert_settings");
    if (savedAlertSettings) {
      try {
        setAlertSettings(JSON.parse(savedAlertSettings.config_value));
      } catch (e) {
        console.error("Error parsing alert settings", e);
      }
    }

    const savedPlanningSettings = systemConfig.find(c => c.config_key === "planning_settings");
    if (savedPlanningSettings) {
      try {
        setPlanningSettings(JSON.parse(savedPlanningSettings.config_value));
      } catch (e) {
        console.error("Error parsing planning settings", e);
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

  const saveAlertSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const existing = systemConfig.find(c => c.config_key === "alert_settings");
      const payload = {
        config_key: "alert_settings",
        config_value: JSON.stringify(data),
        description: "Configurações de limites e alertas do sistema"
      };

      if (existing) {
        return base44.entities.SystemConfig.update(existing.id, payload);
      } else {
        return base44.entities.SystemConfig.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
      toast.success("✓ Limites e alertas salvos");
    }
  });

  const handleSaveAlertSettings = () => {
    saveAlertSettingsMutation.mutate(alertSettings);
  };

  const savePlanningSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const existing = systemConfig.find(c => c.config_key === "planning_settings");
      const payload = {
        config_key: "planning_settings",
        config_value: JSON.stringify(data),
        description: "Configurações de planejamento de produção"
      };

      if (existing) {
        return base44.entities.SystemConfig.update(existing.id, payload);
      } else {
        return base44.entities.SystemConfig.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
      toast.success("✓ Configurações de planejamento salvas");
    }
  });

  const handleSavePlanningSettings = () => {
    savePlanningSettingsMutation.mutate(planningSettings);
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
                <CardTitle className="text-lg">Limites e Alertas</CardTitle>
                <CardDescription>Defina quando o sistema deve gerar alertas no Dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* LIMITE DE PERDA */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Limite de Perda</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">Tipo de cálculo</Label>
                    <Select 
                      value={alertSettings.loss_calc_type}
                      onValueChange={(value) => setAlertSettings({...alertSettings, loss_calc_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Percentual fixo</SelectItem>
                        <SelectItem value="average_plus">Média + percentual (recomendado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {alertSettings.loss_calc_type === 'fixed' ? (
                    <div>
                      <Label className="text-sm text-slate-600">Percentual fixo</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={alertSettings.loss_fixed_percent}
                          onChange={(e) => setAlertSettings({...alertSettings, loss_fixed_percent: parseFloat(e.target.value)})}
                          min="0"
                          max="100"
                          step="1"
                          className="w-24"
                        />
                        <span className="text-sm text-slate-600">%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Exemplo: 10%</p>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-sm text-slate-600">Média + percentual adicional</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Média +</span>
                        <Input
                          type="number"
                          value={alertSettings.loss_average_plus}
                          onChange={(e) => setAlertSettings({...alertSettings, loss_average_plus: parseFloat(e.target.value)})}
                          min="0"
                          max="100"
                          step="1"
                          className="w-24"
                        />
                        <span className="text-sm text-slate-600">%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Padrão: 5%</p>
                    </div>
                  )}
                </div>

                {/* ALERTA DE VENDA BAIXA */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Alerta de Venda Baixa</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Alertar quando venda for menor que:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={alertSettings.low_sales_percent}
                        onChange={(e) => setAlertSettings({...alertSettings, low_sales_percent: parseFloat(e.target.value)})}
                        min="0"
                        max="100"
                        step="5"
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">% do planejado</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Padrão: 50%</p>
                  </div>
                </div>

                {/* ALERTA DE PRODUTO SEM VENDA */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Alerta de Produto Sem Venda</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Alertar quando produto não vender por:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={alertSettings.no_sales_days}
                        onChange={(e) => setAlertSettings({...alertSettings, no_sales_days: parseInt(e.target.value)})}
                        min="1"
                        max="30"
                        step="1"
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">dias</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Padrão: 4 dias</p>
                  </div>
                </div>

                {/* ALERTA DE VENDA ALTA */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Alerta de Venda Alta</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alertSettings.high_sales_enabled}
                        onCheckedChange={(checked) => setAlertSettings({...alertSettings, high_sales_enabled: checked})}
                      />
                      <span className="text-sm text-slate-600">
                        {alertSettings.high_sales_enabled ? 'Habilitado' : 'Desabilitado'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Alertar quando venda for maior que:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={alertSettings.high_sales_percent}
                        onChange={(e) => setAlertSettings({...alertSettings, high_sales_percent: parseFloat(e.target.value)})}
                        min="100"
                        max="300"
                        step="5"
                        className="w-24"
                        disabled={!alertSettings.high_sales_enabled}
                      />
                      <span className={`text-sm ${alertSettings.high_sales_enabled ? 'text-slate-600' : 'text-slate-400'}`}>
                        % do planejado
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Padrão: 130%</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleSaveAlertSettings}
                    disabled={saveAlertSettingsMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Limites e Alertas
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
                <CardDescription>Defina parâmetros para cálculo de sugestão automática</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* BASE DE CÁLCULO */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Base de Cálculo</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Calcular média com base em:
                    </Label>
                    <Select 
                      value={planningSettings.calculation_weeks.toString()}
                      onValueChange={(value) => setPlanningSettings({...planningSettings, calculation_weeks: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">Últimas 2 semanas</SelectItem>
                        <SelectItem value="4">Últimas 4 semanas (recomendado)</SelectItem>
                        <SelectItem value="6">Últimas 6 semanas</SelectItem>
                        <SelectItem value="8">Últimas 8 semanas</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">Padrão: 4 semanas</p>
                  </div>
                </div>

                {/* MARGEM DE SEGURANÇA */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Margem de Segurança Padrão</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Acrescentar margem de segurança:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={planningSettings.safety_margin}
                        onChange={(e) => setPlanningSettings({...planningSettings, safety_margin: parseFloat(e.target.value)})}
                        min="0"
                        max="100"
                        step="5"
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Aplicado quando vendas sobem e perdas caem (Padrão: 10%)
                    </p>
                  </div>
                </div>

                {/* IMPACTO DE FERIADO */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Impacto de Feriado</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Aumentar produção em semanas com feriado:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={planningSettings.holiday_impact}
                        onChange={(e) => setPlanningSettings({...planningSettings, holiday_impact: parseFloat(e.target.value)})}
                        min="0"
                        max="200"
                        step="5"
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Padrão: 30%</p>
                  </div>
                </div>

                {/* IMPACTO DE EVENTO ESPECIAL */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Impacto de Evento Especial</Label>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">
                      Aumentar produção em semanas com evento:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={planningSettings.event_impact}
                        onChange={(e) => setPlanningSettings({...planningSettings, event_impact: parseFloat(e.target.value)})}
                        min="0"
                        max="200"
                        step="5"
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Padrão: 30%</p>
                  </div>
                </div>

                {/* AUTO-PREENCHER */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Auto-preencher Planejamento</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={planningSettings.auto_fill_enabled}
                        onCheckedChange={(checked) => setPlanningSettings({...planningSettings, auto_fill_enabled: checked})}
                      />
                      <span className="text-sm text-slate-600">
                        {planningSettings.auto_fill_enabled ? 'Habilitado' : 'Desabilitado'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {planningSettings.auto_fill_enabled 
                      ? 'Campos virão preenchidos automaticamente ao abrir' 
                      : 'Será necessário clicar em "Recalcular" para sugestões'}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleSavePlanningSettings}
                    disabled={savePlanningSettingsMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações de Planejamento
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