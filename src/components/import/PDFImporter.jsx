import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { getWeek, getMonth, getYear, parseISO } from "date-fns";
import { toast } from "sonner";
import ProductMapper from "./ProductMapper";
import { SECTORS } from "../common/SectorBadge";

export default function PDFImporter({ products, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [recordType, setRecordType] = useState(null);
  const [unmatchedProducts, setUnmatchedProducts] = useState([]);
  const [mapperDialog, setMapperDialog] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState(false);
  const [duplicates, setDuplicates] = useState([]);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            tipo_documento: {
              type: "string",
              enum: ["venda", "perda"],
              description: "Se é 'Curva ABC' ou contém 'Valor' = venda. Se é 'Perdas por Departamento' = perda"
            },
            periodo_inicio: {
              type: "string",
              format: "date",
              description: "Data inicial do período"
            },
            periodo_fim: {
              type: "string",
              format: "date",
              description: "Data final do período"
            },
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo: { 
                    type: "string",
                    description: "Código do produto (ex: 1642, 004111)"
                  },
                  produto: { 
                    type: "string",
                    description: "Nome LIMPO do produto, sem código, unidade (KG/UN), valores, preços ou números. Remova prefixos numéricos e códigos. Ex: 'TORTA NOZES C CHOCOLATE' (não '1642 TORTA NOZES'), 'COOKIES RECHEADO' (não '735 COOKIES')"
                  },
                  quantidade: { 
                    type: "number",
                    description: "Quantidade (Qtde na perda, Qtde na venda)"
                  },
                  unidade: {
                    type: "string",
                    description: "Unidade de medida (KG, UN, etc)"
                  }
                },
                required: ["produto", "quantidade"]
              }
            }
          },
          required: ["tipo_documento", "itens"]
        }
      });

      if (result.status === "success" && result.output) {
        const data = result.output;
        setRecordType(data.tipo_documento);
        
        const extractedItems = data.itens || [];
        
        // Função de normalização para matching inteligente
        const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        
        // Criar mapa de produtos existentes
        const productMap = {};
        products.forEach(p => {
          const normalizedName = normalize(p.name);
          productMap[normalizedName] = p;
          
          // Se tiver código, também mapear por código
          if (p.code) {
            const normalizedCode = normalize(p.code);
            productMap[normalizedCode] = p;
          }
        });
        
        // Fazer matching e identificar produtos novos
        const itemsWithMatching = extractedItems.map(item => {
          const normalizedProduct = normalize(item.produto);
          const normalizedCode = normalize(item.codigo || "");
          
          // Tentar match por nome ou código
          let matchedProduct = productMap[normalizedProduct] || productMap[normalizedCode];
          
          return {
            ...item,
            produto: matchedProduct?.name || item.produto,
            codigo: item.codigo || "",
            matched_product_id: matchedProduct?.id,
            isNew: !matchedProduct,
            setor: matchedProduct?.sector || "Confeitaria"
          };
        });
        
        const unknownProducts = itemsWithMatching.filter(item => item.isNew);

        setExtractedData({
          ...data,
          itens: itemsWithMatching
        });

        // Se há produtos não encontrados, abrir diálogo de mapeamento
        if (unknownProducts.length > 0) {
          setUnmatchedProducts(unknownProducts.map(p => ({
            name: p.produto,
            code: p.codigo || "",
            sector: "Confeitaria",
            unit: p.unidade?.toLowerCase() === 'kg' ? 'kilo' : 'unidade',
            quantity: p.quantidade
          })));
          setMapperDialog(true);
        }
      } else {
        toast.error("Erro ao extrair dados do PDF");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setLoading(false);
    }
  };

  const handleProductMapping = async (mappings, newProductsData, removedProducts = new Set()) => {
    try {
      // Criar novos produtos
      const productsToCreate = Object.entries(newProductsData).map(([name, data]) => ({
        code: data.code || "",
        name: name,
        sector: data.sector,
        unit: data.unit,
        recipe_yield: 1,
        active: true
      }));

      let createdProducts = [];
      if (productsToCreate.length > 0) {
        createdProducts = await base44.entities.Product.bulkCreate(productsToCreate);
        toast.success(`${productsToCreate.length} produto(s) criado(s)`);
      }

      // Atualizar extractedData com os mapeamentos
      const updatedItems = extractedData.itens.filter(item => {
        // Remover produtos que foram marcados para ignorar
        if (removedProducts.has(item.produto)) return false;
        return true;
      }).map(item => {
        if (item.isNew) {
          // Verificar se foi mapeado para produto existente
          if (mappings[item.produto]) {
            const mappedProduct = products.find(p => p.id === mappings[item.produto]);
            return {
              ...item,
              produto: mappedProduct.name,
              matched_product_id: mappedProduct.id,
              isNew: false,
              setor: mappedProduct.sector
            };
          }
          
          // Verificar se é um novo produto criado
          const newProduct = createdProducts.find(p => p.name === item.produto);
          if (newProduct) {
            return {
              ...item,
              produto: newProduct.name,
              matched_product_id: newProduct.id,
              isNew: false,
              setor: newProduct.sector
            };
          }
        }
        return item;
      });

      setExtractedData({
        ...extractedData,
        itens: updatedItems
      });
      
      onImportComplete?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar mapeamento");
    }
  };

  const handleImport = async () => {
    if (!extractedData || !recordType) return;
    
    // Verificar se ainda há produtos não mapeados
    const stillUnmatched = extractedData.itens.filter(item => item.isNew);
    if (stillUnmatched.length > 0) {
      toast.error("Ainda há produtos não mapeados. Por favor, mapeie todos antes de importar.");
      return;
    }

    // Verificar duplicatas por semana
    const isSalesReport = recordType === "venda";
    const existingRecords = isSalesReport 
      ? await base44.entities.SalesRecord.list()
      : await base44.entities.LossRecord.list();

    const dateStr = extractedData.periodo_inicio || new Date().toISOString().split('T')[0];
    const dateObj = parseISO(dateStr);
    const weekNumber = getWeek(dateObj);
    const year = getYear(dateObj);

    const duplicateItems = [];
    extractedData.itens.forEach(item => {
      const existing = existingRecords.find(r => 
        r.product_id === item.matched_product_id &&
        r.week_number === weekNumber &&
        r.year === year
      );
      if (existing) {
        duplicateItems.push({
          ...item,
          existingQuantity: existing.quantity,
          newQuantity: item.quantidade,
          existingRecordId: existing.id,
          existingDate: existing.date
        });
      }
    });

    if (duplicateItems.length > 0) {
      setDuplicates(duplicateItems);
      setDuplicateDialog(true);
      return;
    }

    await performImport("ignore");
  };

  const performImport = async (mode) => {
    // mode: "ignore", "sum", "replace"
    setLoading(true);
    
    try {
      const date = extractedData.periodo_inicio || new Date().toISOString().split('T')[0];
      const dateObj = parseISO(date);
      const weekNumber = getWeek(dateObj);
      const year = getYear(dateObj);
      
      const isSalesReport = recordType === "venda";
      const existingRecords = isSalesReport 
        ? await base44.entities.SalesRecord.list()
        : await base44.entities.LossRecord.list();

      for (const item of extractedData.itens) {
        const existing = existingRecords.find(r => 
          r.product_id === item.matched_product_id &&
          r.week_number === weekNumber &&
          r.year === year
        );

        const recordData = {
          product_id: item.matched_product_id,
          product_name: item.produto,
          sector: item.setor,
          quantity: parseFloat(item.quantidade || 0),
          date: date,
          week_number: weekNumber,
          month: getMonth(dateObj) + 1,
          year: year
        };

        if (existing && mode === "sum") {
          // Somar quantidades
          recordData.quantity = existing.quantity + recordData.quantity;
          if (isSalesReport) {
            await base44.entities.SalesRecord.update(existing.id, recordData);
          } else {
            await base44.entities.LossRecord.update(existing.id, recordData);
          }
        } else if (existing && mode === "replace") {
          // Substituir
          if (isSalesReport) {
            await base44.entities.SalesRecord.update(existing.id, recordData);
          } else {
            await base44.entities.LossRecord.update(existing.id, recordData);
          }
        } else if (!existing) {
          // Criar novo registro
          if (isSalesReport) {
            await base44.entities.SalesRecord.create(recordData);
          } else {
            await base44.entities.LossRecord.create(recordData);
          }
        }
      }

      toast.success(`Registros de ${recordType} importados para o histórico`);
      setDuplicateDialog(false);
      setFile(null);
      setExtractedData(null);
      setRecordType(null);
      onImportComplete?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar registros");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar PDF do ERP Lince
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Relatórios de vendas (Curva ABC) e perdas (Perdas por Departamento)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-slate-300 transition-colors">
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-upload"
            />
            <Label htmlFor="pdf-upload" className="cursor-pointer">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                  <span className="text-sm text-slate-500">Processando PDF...</span>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-blue-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="text-sm text-slate-500">Clique para selecionar o PDF</span>
                  <span className="text-xs text-slate-400">Relatórios de Venda ou Perda do ERP Lince</span>
                </div>
              )}
            </Label>
          </div>

          {extractedData && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    recordType === "venda" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {recordType === "venda" ? "Venda" : "Perda"}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  Período: {extractedData.periodo_inicio} até {extractedData.periodo_fim}
                </div>
                <div className="text-sm text-slate-600">
                  {extractedData.itens?.length} item(s)
                </div>
              </div>

              <div className="max-h-64 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs">Setor</TableHead>
                      <TableHead className="text-xs text-right">Quantidade</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedData.itens?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs text-slate-500">{item.codigo || "—"}</TableCell>
                        <TableCell className="text-sm">{item.produto}</TableCell>
                        <TableCell className="text-sm">{item.setor}</TableCell>
                        <TableCell className="text-sm text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-center">
                          {item.isNew ? (
                            <span className="text-xs text-orange-600 flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Não mapeado
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> Pronto
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button 
                onClick={handleImport} 
                disabled={extractedData.itens.some(item => item.isNew)}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Importar para o Histórico
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductMapper
        open={mapperDialog}
        onClose={() => setMapperDialog(false)}
        unmatchedProducts={unmatchedProducts}
        existingProducts={products}
        onMap={handleProductMapping}
      />

      <Dialog open={duplicateDialog} onOpenChange={setDuplicateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Registros Duplicados Detectados (Mesma Semana)
            </DialogTitle>
            <p className="text-sm text-slate-600 mt-2">
              Encontramos {duplicates.length} produto(s) que já possuem registros na mesma semana.
            </p>
          </DialogHeader>

          <div className="max-h-64 overflow-auto space-y-2">
            {duplicates.map((dup, idx) => (
              <div key={idx} className="border rounded-lg p-3 bg-slate-50">
                <div className="font-medium text-sm">{dup.produto}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Registro existente ({dup.existingDate}): {dup.existingQuantity}
                </div>
                <div className="text-xs text-slate-600">
                  Novo registro: {dup.newQuantity}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Se somar: {dup.existingQuantity + dup.newQuantity}
                </div>
                <div className="text-xs text-blue-600">
                  Se substituir: {dup.newQuantity}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDuplicateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="outline"
              onClick={() => performImport("replace")}
            >
              Substituir
            </Button>
            <Button variant="outline" onClick={() => performImport("sum")}>
              Somar Quantidades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}