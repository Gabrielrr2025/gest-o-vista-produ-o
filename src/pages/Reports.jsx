import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, subWeeks, subMonths, startOfYear } from "date-fns";

export default function Reports() {
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [filters, setFilters] = useState({
    period: '4weeks',
    startDate: format(subWeeks(new Date(), 4), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    comparisonType: 'weeks',
    sector: 'all',
    product: 'all'
  });

  // Verificar permissão de acesso
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        
        // MASTER sempre tem acesso
        if (user.role === 'admin') {
          setCurrentUser(user);
          setHasAccess(true);
          return;
        }
        
        // Outros usuários: verificar permissão reports_access
        if (user.reports_access === true) {
          setCurrentUser(user);
          setHasAccess(true);
        } else {
          toast.error("Você não tem permissão para acessar esta área");
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

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: hasAccess
  });

  const handlePeriodChange = (value) => {
    const today = new Date();
    let start;
    
    if (value !== 'custom') {
      switch(value) {
        case 'week':
          start = subWeeks(today, 1);
          break;
        case '4weeks':
          start = subWeeks(today, 4);
          break;
        case 'month':
          start = subMonths(today, 1);
          break;
        case '3months':
          start = subMonths(today, 3);
          break;
        case 'year':
          start = startOfYear(today);
          break;
        default:
          start = subWeeks(today, 4);
      }
      
      setFilters({
        ...filters,
        period: value,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd')
      });
    } else {
      setFilters({
        ...filters,
        period: 'custom'
      });
    }
  };

  const handleApplyFilters = () => {
    toast.success("Filtros aplicados");
    // Aqui virão os cálculos e gráficos
  };

  const handleExportPDF = () => {
    toast.info("Exportação em PDF em desenvolvimento");
  };

  const handleExportExcel = () => {
    toast.info("Exportação em Excel em desenvolvimento");
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Relatórios
          </h1>
          <p className="text-sm text-slate-500 mt-1">Análise gerencial e estratégica</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PAINEL DE FILTROS */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* PERÍODO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Período</Label>
                <Select 
                  value={filters.period} 
                  onValueChange={handlePeriodChange}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="4weeks">Últimas 4 semanas</SelectItem>
                    <SelectItem value="month">Último mês</SelectItem>
                    <SelectItem value="3months">Últimos 3 meses</SelectItem>
                    <SelectItem value="year">Ano atual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>

                {filters.period === 'custom' && (
                  <div className="space-y-2 mt-3">
                    <div>
                      <Label className="text-xs text-slate-600">Data Início</Label>
                      <Input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Data Fim</Label>
                      <Input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        className="h-10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TIPO DE COMPARAÇÃO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Comparar por</Label>
                <Select 
                  value={filters.comparisonType} 
                  onValueChange={(value) => setFilters({...filters, comparisonType: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weeks">Semanas</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                    <SelectItem value="products">Produtos</SelectItem>
                    <SelectItem value="sectors">Setores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SETOR */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Filtrar por setor</Label>
                <Select 
                  value={filters.sector} 
                  onValueChange={(value) => setFilters({...filters, sector: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    <SelectItem value="Padaria">Padaria</SelectItem>
                    <SelectItem value="Confeitaria">Confeitaria</SelectItem>
                    <SelectItem value="Salgados">Salgados</SelectItem>
                    <SelectItem value="Frios">Frios</SelectItem>
                    <SelectItem value="Restaurante">Restaurante</SelectItem>
                    <SelectItem value="Minimercado">Minimercado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PRODUTO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Filtrar por produto</Label>
                <Select 
                  value={filters.product} 
                  onValueChange={(value) => setFilters({...filters, product: value})}
                  disabled={filters.comparisonType !== 'products'}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.comparisonType !== 'products' && (
                  <p className="text-xs text-slate-500 mt-1">
                    Disponível ao selecionar "Produtos"
                  </p>
                )}
              </div>

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 h-10"
                onClick={handleApplyFilters}
              >
                Aplicar Filtros
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ÁREA DE GRÁFICOS/CONTEÚDO */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="py-20 text-center">
              <div className="text-slate-400 text-sm">
                Os gráficos e análises aparecerão aqui após configurar os filtros
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}