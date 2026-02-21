import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertCircle, Plus, Check, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { toast } from "sonner";
import SectorBadge from "../common/SectorBadge";

export default function UnmappedProductsSuggestion({ sqlData, products, onProductCreated }) {
  const [creating, setCreating] = useState(new Set());
  const [dismissed, setDismissed] = useState(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Detectar produtos da VIEW que não existem no cadastro
  const unmappedProducts = useMemo(() => {
    if (!sqlData || !sqlData.sales || !sqlData.losses) {
      return [];
    }

    const allSQLProducts = new Map();

    // Coletar produtos únicos da VIEW SQL
    [...sqlData.sales, ...sqlData.losses].forEach(record => {
      const name = (record.product_name || '').trim();
      const sector = (record.sector || '').trim();
      if (!name) return;
      const key = `${name.toLowerCase()}-${sector.toLowerCase()}`;
      if (!allSQLProducts.has(key)) {
        allSQLProducts.set(key, {
          name,
          code: record.product_code,
          sector,
          sales: 0,
          losses: 0
        });
      }
      const product = allSQLProducts.get(key);
      if (sqlData.sales.includes(record)) {
        product.sales += record.quantity || 0;
      }
      if (sqlData.losses.includes(record)) {
        product.losses += record.quantity || 0;
      }
    });

    // Criar índices dos produtos cadastrados (tudo em lowercase + trim para comparação segura)
    const normalize = (str) => (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
    
    const registeredByCode = new Set(
      (products || []).filter(p => p.code).map(p => normalize(p.code))
    );
    const registeredByName = new Set(
      (products || []).map(p => `${normalize(p.name)}-${normalize(p.sector)}`)
    );
    // Também criar um set apenas por nome (sem setor) para capturar variações
    const registeredByNameOnly = new Set(
      (products || []).map(p => normalize(p.name))
    );

    // Filtrar produtos não cadastrados
    const unmapped = [];
    allSQLProducts.forEach((product) => {
      const isRegisteredByCode = product.code && registeredByCode.has(normalize(product.code));
      const isRegisteredByName = registeredByName.has(`${normalize(product.name)}-${normalize(product.sector)}`);
      const isRegisteredByNameOnly = registeredByNameOnly.has(normalize(product.name));

      if (!isRegisteredByCode && !isRegisteredByName && !isRegisteredByNameOnly) {
        unmapped.push(product);
      }
    });

    return unmapped.sort((a, b) => (b.sales + b.losses) - (a.sales + a.losses));
  }, [sqlData, products]);

  const handleCreateProduct = async (product) => {
    const key = `${product.name}-${product.sector}`;
    setCreating(prev => new Set(prev).add(key));

    try {
      const response = await base44.functions.invoke('Createproduct', {
        code: product.code || '',
        name: product.name,
        sector: product.sector,
        recipe_yield: 1,
        unit: 'UN',
        production_days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
        active: true
      });

      // Base44 pode retornar dados em response direto ou em response.data
      const data = response?.data || response;
      const errorMsg = data?.error || response?.error;

      if (errorMsg) {
        if (errorMsg.includes('já existe')) {
          toast.info(`Produto "${product.name}" já está cadastrado`);
          setDismissed(prev => new Set(prev).add(key));
          await onProductCreated?.();
        } else if (errorMsg.includes('conexão') || errorMsg.includes('POSTGRES_CONNECTION_URL')) {
          toast.error('Erro: Banco de dados não configurado. Verifique as variáveis de ambiente.');
        } else if (errorMsg.includes('Tabela') || errorMsg.includes('não existe')) {
          toast.error('Erro: Tabela de produtos não existe no banco. Execute o script SQL.');
        } else {
          toast.error(`Erro: ${errorMsg}`);
        }
      } else if (data?.success || data?.product) {
        toast.success(`Produto "${product.name}" cadastrado com sucesso!`);
        setDismissed(prev => new Set(prev).add(key));
        // Aguardar refresh para garantir que a lista de produtos atualize
        if (onProductCreated) await onProductCreated();
      } else {
        toast.error('Erro: Resposta inesperada do servidor');
      }
    } catch (error) {
      if (error.response?.status === 409 || error.response?.data?.error?.includes('já existe')) {
        toast.info(`Produto "${product.name}" já está cadastrado`);
        setDismissed(prev => new Set(prev).add(key));
        await onProductCreated?.();
      } else if (error.response?.status === 500) {
        toast.error('Erro interno do servidor (500). Verifique os logs do console.');
      } else if (error.response?.status === 400) {
        toast.error('Erro: Dados inválidos enviados ao servidor');
      } else if (error.message) {
        toast.error(`Erro: ${error.message}`);
      } else {
        toast.error('Erro desconhecido ao cadastrar produto');
      }
    } finally {
      setCreating(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCreateAll = async () => {
    for (const product of visibleProducts) {
      await handleCreateProduct(product);
    }
  };

  const handleDismiss = (product) => {
    const key = `${product.name}-${product.sector}`;
    setDismissed(prev => new Set(prev).add(key));
  };

  const visibleProducts = unmappedProducts.filter(product => {
    const key = `${product.name}-${product.sector}`;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.code && product.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return !dismissed.has(key) && matchesSearch;
  });

  if (unmappedProducts.filter(p => !dismissed.has(`${p.name}-${p.sector}`)).length === 0) {
    return null;
  }

  const totalUnmapped = unmappedProducts.filter(p => !dismissed.has(`${p.name}-${p.sector}`)).length;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-lg text-orange-900">
              Produtos Detectados na VIEW SQL
            </CardTitle>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
              {totalUnmapped} {totalUnmapped === 1 ? 'produto' : 'produtos'}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-orange-700 hover:bg-orange-100"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          <p className="text-sm text-orange-800">
            Encontramos produtos na VIEW SQL que ainda não estão cadastrados no sistema.
            Cadastre-os para ativar o planejamento de produção e rastreamento completo.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
              <Input
                placeholder="Buscar por nome, código ou setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-orange-200 focus:border-orange-400"
              />
            </div>
            <Button
              size="sm"
              onClick={handleCreateAll}
              disabled={creating.size > 0 || visibleProducts.length === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Cadastrar Todos
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
          {visibleProducts.map((product, idx) => {
            const key = `${product.name}-${product.sector}`;
            const isCreating = creating.has(key);

            return (
              <div
                key={idx}
                className="bg-white border border-orange-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900">{product.name}</span>
                    {product.code && (
                      <Badge variant="outline" className="text-xs">
                        {product.code}
                      </Badge>
                    )}
                    <SectorBadge sector={product.sector} />
                  </div>
                  <div className="flex gap-3 text-xs text-slate-600">
                    <span>Vendas: {Math.round(product.sales * 100) / 100}</span>
                    <span>Perdas: {Math.round(product.losses * 100) / 100}</span>
                    <span>Total: {Math.round((product.sales + product.losses) * 100) / 100}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(product)}
                    disabled={isCreating}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateProduct(product)}
                    disabled={isCreating}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mr-1" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
          </div>

          {visibleProducts.length === 0 && searchTerm && (
            <div className="text-center py-8 text-orange-600">
              Nenhum produto encontrado para "{searchTerm}"
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
