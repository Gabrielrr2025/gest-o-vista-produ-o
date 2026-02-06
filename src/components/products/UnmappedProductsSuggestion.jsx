import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import SectorBadge from "../common/SectorBadge";

export default function UnmappedProductsSuggestion({ sqlData, products, onProductCreated }) {
  const [creating, setCreating] = useState(new Set());

  // Detectar produtos da VIEW que não existem no cadastro
  const unmappedProducts = useMemo(() => {
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

    // Criar índices dos produtos cadastrados
    const registeredByCode = new Set(products.filter(p => p.code).map(p => p.code.toLowerCase().trim()));
    const registeredByName = new Set(products.map(p => `${p.name.toLowerCase().trim()}-${p.sector}`));

    // Filtrar produtos não cadastrados
    const unmapped = [];
    allSQLProducts.forEach((product, key) => {
      const isRegisteredByCode = product.code && registeredByCode.has(product.code.toLowerCase().trim());
      const isRegisteredByName = registeredByName.has(`${product.name.toLowerCase().trim()}-${product.sector}`);
      
      if (!isRegisteredByCode && !isRegisteredByName) {
        unmapped.push(product);
      }
    });

    return unmapped.sort((a, b) => (b.sales + b.losses) - (a.sales + a.losses));
  }, [sqlData, products]);

  const handleCreateProduct = async (product) => {
    const key = `${product.name}-${product.sector}`;
    setCreating(prev => new Set(prev).add(key));
    
    try {
      await base44.entities.Product.create({
        code: product.code || '',
        name: product.name,
        sector: product.sector,
        recipe_yield: 1,
        unit: 'unidade',
        production_days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
        active: true
      });
      
      toast.success(`Produto "${product.name}" cadastrado`);
      onProductCreated?.();
    } catch (error) {
      toast.error('Erro ao cadastrar produto');
      console.error(error);
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

  if (unmappedProducts.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-lg text-orange-900">
              Produtos Detectados na VIEW SQL
            </CardTitle>
          </div>
          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
            {unmappedProducts.length} {unmappedProducts.length === 1 ? 'produto' : 'produtos'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-orange-800">
          Encontramos produtos na VIEW SQL que ainda não estão cadastrados no sistema. 
          Cadastre-os para ativar o planejamento de produção e rastreamento completo.
        </p>

        <div className="flex gap-2 mb-3">
          <Button 
            size="sm" 
            onClick={handleCreateAll}
            disabled={creating.size > 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Cadastrar Todos
          </Button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {unmappedProducts.map((product, idx) => {
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
                    <span>Vendas: {product.sales}</span>
                    <span>Perdas: {product.losses}</span>
                    <span>Total: {product.sales + product.losses}</span>
                  </div>
                </div>
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}