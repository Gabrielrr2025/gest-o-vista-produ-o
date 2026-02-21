import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp, Search } from "lucide-react";

export default function ProductRanking({ 
  products, 
  selectedSector,
  selectedProduct,
  onProductClick,
  type = 'sales' // 'sales' ou 'losses'
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar produtos pela busca
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.produto_nome.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

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
    `Produtos - Vendas` : 
    `Produtos - Perdas`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{title}</span>
            {selectedSector && (
              <Badge variant="outline">{selectedSector}</Badge>
            )}
          </div>
          <Badge variant="secondary">
            {filteredProducts.length} de {products.length}
          </Badge>
        </CardTitle>

        {/* Campo de Busca */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Container com scroll fixo */}
        <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product, index) => {
              const isSelected = selectedProduct === product.produto_id;
              const valor = parseFloat(product.total_valor);
              const quantidade = parseFloat(product.total_quantidade);
              
              // Índice real (considerando a posição original)
              const realIndex = products.findIndex(p => p.produto_id === product.produto_id);

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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
                      realIndex === 0 ? 'bg-yellow-100 text-yellow-700' :
                      realIndex === 1 ? 'bg-slate-200 text-slate-700' :
                      realIndex === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {realIndex + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
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
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="font-bold text-slate-900 whitespace-nowrap">
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
                    <div className="ml-3 flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nenhum produto encontrado para "{searchTerm}"</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
