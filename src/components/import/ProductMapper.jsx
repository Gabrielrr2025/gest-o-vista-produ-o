import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Link2, Plus } from "lucide-react";
import SectorBadge from "../common/SectorBadge";

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

  const handleMap = (unmatchedName, existingProductId) => {
    setMappings({ ...mappings, [unmatchedName]: existingProductId });
    // Remove from new products if was there
    const updated = { ...newProducts };
    delete updated[unmatchedName];
    setNewProducts(updated);
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
    onMap(mappings, newProducts);
    onClose();
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
          {unmatchedProducts.map((product, idx) => {
            const decision = getDecision(product.name);
            
            return (
              <div key={idx} className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{product.name}</div>
                    {product.code && (
                      <div className="text-xs text-slate-500">Código: {product.code}</div>
                    )}
                    <div className="text-xs text-slate-600 mt-1">
                      Quantidade no PDF: {product.quantity} {product.unit}
                    </div>
                  </div>
                  {decision === 'map' && (
                    <Badge className="bg-blue-100 text-blue-700">Vinculado</Badge>
                  )}
                  {decision === 'new' && (
                    <Badge className="bg-green-100 text-green-700">Criar Novo</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Opção: Vincular a produto existente */}
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="text-xs font-medium text-slate-600 mb-2">
                      Vincular a produto existente
                    </div>
                    <Select
                      value={mappings[product.name] || ""}
                      onValueChange={(value) => handleMap(product.name, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingProducts.map(p => (
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
            disabled={unmatchedProducts.some(p => !getDecision(p.name))}
          >
            Confirmar ({Object.keys(mappings).length} vinculados, {Object.keys(newProducts).length} novos)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}