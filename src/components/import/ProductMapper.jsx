import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Link2, Plus, Trash2, Search } from "lucide-react";
import SectorBadge from "../common/SectorBadge";

// Função de similaridade simples
const getSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords / totalWords;
};

export default function ProductMapper({ 
  open, 
  onClose, 
  unmatchedProducts, 
  existingProducts,
  onMap,
  onCreateNew
}) {
  const [mappings, setMappings] = useState({});
  const [newProducts, setNewProducts] = useState({});
  const [searchTerms, setSearchTerms] = useState({});
  const [removedProducts, setRemovedProducts] = useState(new Set());

  // Calcular sugestões automáticas por similaridade
  const suggestions = useMemo(() => {
    const result = {};
    unmatchedProducts.forEach(unmatched => {
      const scores = existingProducts.map(existing => ({
        product: existing,
        score: getSimilarity(unmatched.name, existing.name)
      }));
      scores.sort((a, b) => b.score - a.score);
      result[unmatched.name] = scores.slice(0, 3); // Top 3 sugestões
    });
    return result;
  }, [unmatchedProducts, existingProducts]);

  const handleMap = (unmatchedName, existingProductId) => {
    setMappings({ ...mappings, [unmatchedName]: existingProductId });
    const updated = { ...newProducts };
    delete updated[unmatchedName];
    setNewProducts(updated);
  };

  const handleRemove = (productName) => {
    setRemovedProducts(new Set([...removedProducts, productName]));
    const updatedMappings = { ...mappings };
    delete updatedMappings[productName];
    setMappings(updatedMappings);
    const updatedNew = { ...newProducts };
    delete updatedNew[productName];
    setNewProducts(updatedNew);
  };

  const handleCreateNew = (unmatchedProduct) => {
    setNewProducts({
      ...newProducts,
      [unmatchedProduct.name]: {
        code: unmatchedProduct.code || "",
        sector: unmatchedProduct.sector || "Confeitaria",
        unit: unmatchedProduct.unit || "unidade"
      }
    });
    // Remove from mappings if was there
    const updated = { ...mappings };
    delete updated[unmatchedProduct.name];
    setMappings(updated);
  };

  const handleConfirm = () => {
    // Filtrar produtos removidos dos não mapeados
    const validUnmatched = unmatchedProducts.filter(p => !removedProducts.has(p.name));
    onMap(mappings, newProducts, removedProducts);
    onClose();
  };

  const getFilteredProducts = (unmatchedName) => {
    const term = searchTerms[unmatchedName]?.toLowerCase() || '';
    if (!term) return existingProducts;
    return existingProducts.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.code && p.code.toLowerCase().includes(term))
    );
  };

  const getDecision = (productName) => {
    if (mappings[productName]) return 'map';
    if (newProducts[productName]) return 'new';
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Mapear Produtos da Importação
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-2">
            Alguns produtos no PDF não foram encontrados. Você pode vinculá-los a produtos existentes ou criar novos.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {unmatchedProducts.filter(p => !removedProducts.has(p.name)).map((product, idx) => {
            const decision = getDecision(product.name);
            const topSuggestions = suggestions[product.name] || [];
            
            return (
              <div key={idx} className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{product.name}</div>
                    {product.code && (
                      <div className="text-xs text-slate-500">Código: {product.code}</div>
                    )}
                    <div className="text-xs text-slate-600 mt-1">
                      Quantidade no PDF: {product.quantity} {product.unit}
                    </div>
                    {topSuggestions.length > 0 && topSuggestions[0].score > 0.3 && (
                      <div className="text-xs text-blue-600 mt-1">
                        💡 Sugestão: {topSuggestions[0].product.name} ({Math.round(topSuggestions[0].score * 100)}% similar)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {decision === 'map' && (
                      <Badge className="bg-blue-100 text-blue-700">Vinculado</Badge>
                    )}
                    {decision === 'new' && (
                      <Badge className="bg-green-100 text-green-700">Criar Novo</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemove(product.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Opção: Vincular a produto existente */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-xs font-medium text-slate-600 mb-2">
                      Vincular a produto existente
                    </div>
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <Input
                        placeholder="Buscar produto..."
                        value={searchTerms[product.name] || ""}
                        onChange={(e) => setSearchTerms({...searchTerms, [product.name]: e.target.value})}
                        className="pl-7 text-xs h-8"
                      />
                    </div>
                    <Select
                      value={mappings[product.name] || ""}
                      onValueChange={(value) => handleMap(product.name, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredProducts(product.name).map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              {p.code && <span className="text-xs text-slate-500">[{p.code}]</span>}
                              {p.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mappings[product.name] && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                        <ArrowRight className="w-3 h-3" />
                        Os valores serão adicionados a este produto
                      </div>
                    )}
                  </div>

                  {/* Opção: Criar novo produto */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-xs font-medium text-slate-600 mb-2">
                      Criar novo produto
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCreateNew(product)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Criar "{product.name}"
                    </Button>
                    {newProducts[product.name] && (
                      <div className="mt-2 space-y-2">
                        <Input
                          placeholder="Código (opcional)"
                          value={newProducts[product.name].code}
                          onChange={(e) => setNewProducts({
                            ...newProducts,
                            [product.name]: {
                              ...newProducts[product.name],
                              code: e.target.value
                            }
                          })}
                          className="text-xs"
                        />
                        <Select
                          value={newProducts[product.name].sector}
                          onValueChange={(value) => setNewProducts({
                            ...newProducts,
                            [product.name]: {
                              ...newProducts[product.name],
                              sector: value
                            }
                          })}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Padaria">Padaria</SelectItem>
                            <SelectItem value="Salgados">Salgados</SelectItem>
                            <SelectItem value="Confeitaria">Confeitaria</SelectItem>
                            <SelectItem value="Minimercado">Minimercado</SelectItem>
                            <SelectItem value="Restaurante">Restaurante</SelectItem>
                            <SelectItem value="Frios">Frios</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={newProducts[product.name].unit}
                          onValueChange={(value) => setNewProducts({
                            ...newProducts,
                            [product.name]: {
                              ...newProducts[product.name],
                              unit: value
                            }
                          })}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unidade">Unidade</SelectItem>
                            <SelectItem value="pacotes">Pacotes</SelectItem>
                            <SelectItem value="kilo">Kilo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={unmatchedProducts.filter(p => !removedProducts.has(p.name)).some(p => !getDecision(p.name))}
          >
            Confirmar ({Object.keys(mappings).length} vinculados, {Object.keys(newProducts).length} novos, {removedProducts.size} ignorados)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}