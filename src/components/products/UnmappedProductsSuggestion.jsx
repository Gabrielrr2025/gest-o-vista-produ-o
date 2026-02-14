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
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Detectar produtos da VIEW que não existem no cadastro
  const unmappedProducts = useMemo(() => {
    console.log('🔍 Detectando produtos não mapeados...');
    console.log('📥 SQL Data recebida:', sqlData);
    console.log('📦 Produtos cadastrados:', products.length);
    
    // Verificar se sqlData existe e tem arrays válidos
    if (!sqlData || !sqlData.sales || !sqlData.losses) {
      console.warn('⚠️ sqlData inválido ou vazio');
      return [];
    }
    
    console.log(`📊 Sales: ${sqlData.sales.length}, Losses: ${sqlData.losses.length}`);
    
    const allSQLProducts = new Map();
    
    // Coletar produtos únicos da VIEW SQL
    [...sqlData.sales, ...sqlData.losses].forEach(record => {
      const key = `${record.product_name}-${record.sector}`;
      if (!allSQLProducts.has(key)) {
        allSQLProducts.set(key, {
          name: record.product_name,
          code: record.product_code,
          sector: record.sector,
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

    console.log(`📊 Total de produtos únicos na VIEW: ${allSQLProducts.size}`);

    // Criar índices dos produtos cadastrados
    const registeredByCode = new Set(
      (products || []).filter(p => p.code).map(p => p.code.toLowerCase().trim())
    );
    const registeredByName = new Set(
      (products || []).map(p => `${p.name.toLowerCase().trim()}-${p.sector}`)
    );

    console.log(`✅ Produtos cadastrados por código: ${registeredByCode.size}`);
    console.log(`✅ Produtos cadastrados por nome: ${registeredByName.size}`);

    // Filtrar produtos não cadastrados
    const unmapped = [];
    allSQLProducts.forEach((product, key) => {
      const isRegisteredByCode = product.code && registeredByCode.has(product.code.toLowerCase().trim());
      const isRegisteredByName = registeredByName.has(`${product.name.toLowerCase().trim()}-${product.sector}`);
      
      if (!isRegisteredByCode && !isRegisteredByName) {
        unmapped.push(product);
        console.log(`🆕 Produto não mapeado encontrado: ${product.name} (${product.sector})`);
      }
    });

    console.log(`🎯 Total de produtos não mapeados: ${unmapped.length}`);
    return unmapped.sort((a, b) => (b.sales + b.losses) - (a.sales + a.losses));
  }, [sqlData, products]);

  const handleCreateProduct = async (product) => {
    const key = `${product.name}-${product.sector}`;
    setCreating(prev => new Set(prev).add(key));
    
    try {
      console.log('📤 Enviando produto para criar:', product);
      
      const response = await base44.functions.invoke('Createproduct', {
        code: product.code || '',
        name: product.name,
        sector: product.sector,
        recipe_yield: 1,
        unit: 'unidade',
        production_days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
        active: true
      });

      console.log('📥 Resposta do servidor:', response);

      // Verificar se houve erro na resposta
      if (response.data?.error || response.error) {
        const errorMsg = response.data?.error || response.error;
        console.error('❌ Erro na resposta:', errorMsg);
        
        // Produto já existe
        if (errorMsg.includes('já existe')) {
          toast.info(`Produto "${product.name}" já está cadastrado`);
          // Remove da lista de não mapeados
          setDismissed(prev => new Set(prev).add(key));
          // Atualiza lista de produtos para mostrar
          await onProductCreated?.();
        } 
        // Erro de conexão com banco
        else if (errorMsg.includes('conexão') || errorMsg.includes('POSTGRES_CONNECTION_URL')) {
          toast.error('Erro: Banco de dados não configurado. Verifique as variáveis de ambiente.');
        }
        // Tabela não existe
        else if (errorMsg.includes('Tabela') || errorMsg.includes('não existe')) {
          toast.error('Erro: Tabela de produtos não existe no banco. Execute o script SQL.');
        }
        // Outros erros
        else {
          toast.error(`Erro: ${errorMsg}`);
        }
      } else if (response.data?.success) {
        console.log('✅ Produto criado com sucesso:', response.data.product);
        toast.success(`Produto "${product.name}" cadastrado`);
        await onProductCreated?.();
      } else {
        console.error('⚠️ Resposta inesperada:', response);
        toast.error('Erro: Resposta inesperada do servidor');
      }
    } catch (error) {
      console.error('❌ Erro ao cadastrar:', error);
      
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
    for (const product of unmappedProducts) {
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