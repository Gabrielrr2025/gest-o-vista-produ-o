import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp } from "lucide-react";

export default function ProductRanking({ 
  products, 
  selectedSector,
  selectedProduct,
  onProductClick,
  type = 'sales' // 'sales' ou 'losses'
}) {
  if (!products || products.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            {selectedSector ? 
              `Nenhum produto encontrado para ${selectedSector}` : 
              'Selecione um setor para ver os produtos'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const title = type === 'sales' ? 
    `Top ${products.length} Produtos - Vendas` : 
    `Top ${products.length} Produtos - Perdas`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          {selectedSector && (
            <Badge variant="outline">{selectedSector}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {products.map((product, index) => {
            const isSelected = selectedProduct === product.produto_id;
            const valor = parseFloat(product.total_valor);
            const quantidade = parseFloat(product.total_quantidade);

            return (
              <div
                key={product.produto_id}
                onClick={() => onProductClick(product.produto_id, product.produto_nome)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected ? 
                    'bg-blue-50 border-blue-300 shadow-sm' : 
                    'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                {/* Ranking + Nome */}
                <div className="flex items-center gap-3 flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-slate-200 text-slate-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {product.produto_nome}
                    </div>
                    <div className="text-xs text-slate-500">
                      {quantidade.toFixed(1)} {product.unidade}
                      {product.taxa_perda !== undefined && (
                        <span className={`ml-2 ${
                          product.taxa_perda > 10 ? 'text-red-600' :
                          product.taxa_perda > 5 ? 'text-orange-600' :
                          'text-slate-600'
                        }`}>
                          • Perda: {product.taxa_perda.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Valor */}
                <div className="text-right">
                  <div className="font-bold text-slate-900">
                    R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {product.variacao !== undefined && product.variacao !== null && (
                    <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${
                      product.variacao > 0 ? 'text-green-600' :
                      product.variacao < 0 ? 'text-red-600' :
                      'text-slate-500'
                    }`}>
                      {product.variacao > 0 ? <ArrowUp className="w-3 h-3" /> :
                       product.variacao < 0 ? <ArrowDown className="w-3 h-3" /> :
                       <Minus className="w-3 h-3" />}
                      {Math.abs(product.variacao).toFixed(1)}%
                    </div>
                  )}
                </div>

                {/* Indicador de seleção */}
                {isSelected && (
                  <div className="ml-3">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
