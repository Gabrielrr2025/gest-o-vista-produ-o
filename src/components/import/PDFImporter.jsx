import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2, Check, AlertCircle, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SECTORS } from "../common/SectorBadge";
import { getWeek, getMonth, getYear, parseISO } from "date-fns";
import { toast } from "sonner";

export default function PDFImporter({ products, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [recordType, setRecordType] = useState(null);
  const [newProductsDialog, setNewProductsDialog] = useState(false);
  const [newProducts, setNewProducts] = useState([]);
  const [selectedNewProducts, setSelectedNewProducts] = useState([]);

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
              description: "Identificar se é relatório de vendas ou de perdas"
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
                  produto: { 
                    type: "string",
                    description: "IMPORTANTE: Extrair SOMENTE o nome do produto, sem detalhes adicionais, códigos, preços ou informações extras. Exemplo: 'Pão Francês' ao invés de 'Pão Francês 50g - Cód 123'"
                  },
                  quantidade: { type: "number" },
                  setor: { 
                    type: "string",
                    enum: SECTORS
                  }
                }
              }
            }
          }
        }
      });

      if (result.status === "success" && result.output) {
        const data = result.output;
        setRecordType(data.tipo_documento);
        
        const extractedItems = data.itens || [];
        
        // Função de normalização para matching inteligente
        const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        
        const productNameMap = {};
        products.forEach(p => {
          productNameMap[normalize(p.name)] = p.name;
        });
        
        // Fazer matching e identificar produtos novos
        const itemsWithMatching = extractedItems.map(item => {
          const normalizedProduct = normalize(item.produto);
          const matchedName = productNameMap[normalizedProduct];
          
          return {
            ...item,
            produto: matchedName || item.produto,
            isNew: !matchedName
          };
        });
        
        const unknownProducts = itemsWithMatching.filter(item => item.isNew);

        setExtractedData({
          ...data,
          itens: itemsWithMatching
        });

        if (unknownProducts.length > 0) {
          setNewProducts(unknownProducts.map(p => ({
            name: p.produto,
            sector: p.setor || "Padaria",
            unit: "unidade",
            selected: true
          })));
          setSelectedNewProducts(unknownProducts.map(p => p.produto));
          setNewProductsDialog(true);
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

  const handleCreateNewProducts = async () => {
    const productsToCreate = newProducts.filter(p => selectedNewProducts.includes(p.name));
    
    try {
      await base44.entities.Product.bulkCreate(
        productsToCreate.map(p => ({
          name: p.name,
          sector: p.sector,
          unit: p.unit || "unidade",
          recipe_yield: 1,
          active: true
        }))
      );
      toast.success(`${productsToCreate.length} produto(s) criado(s)`);
      setNewProductsDialog(false);
    } catch (error) {
      toast.error("Erro ao criar produtos");
    }
  };

  const handleImport = async () => {
    if (!extractedData || !recordType) return;
    
    setLoading(true);
    
    try {
      const records = extractedData.itens.map(item => {
        const date = extractedData.periodo_inicio || new Date().toISOString().split('T')[0];
        const dateObj = parseISO(date);
        
        return {
          product_name: item.produto,
          sector: item.setor || "Padaria",
          quantity: item.quantidade,
          date: date,
          week_number: getWeek(dateObj),
          month: getMonth(dateObj) + 1,
          year: getYear(dateObj)
        };
      });

      if (recordType === "venda") {
        await base44.entities.SalesRecord.bulkCreate(records);
        toast.success(`${records.length} registro(s) de venda importado(s)`);
      } else {
        await base44.entities.LossRecord.bulkCreate(records);
        toast.success(`${records.length} registro(s) de perda importado(s)`);
      }

      setFile(null);
      setExtractedData(null);
      setRecordType(null);
      onImportComplete?.();
    } catch (error) {
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-slate-300 transition-colors">
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-upload"
              disabled={loading}
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
                  Período: {extractedData.periodo_inicio} - {extractedData.periodo_fim}
                </div>
                <div className="text-sm text-slate-600">
                  {extractedData.itens?.length} item(s)
                </div>
              </div>

              <div className="max-h-64 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs">Setor</TableHead>
                      <TableHead className="text-xs text-right">Quantidade</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedData.itens?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">{item.produto}</TableCell>
                        <TableCell className="text-sm">{item.setor}</TableCell>
                        <TableCell className="text-sm text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-center">
                          {item.isNew ? (
                            <span className="text-xs text-orange-600 flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Novo
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> OK
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
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Confirmar Importação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newProductsDialog} onOpenChange={setNewProductsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Produtos Não Cadastrados
            </DialogTitle>
            <DialogDescription>
              Encontramos {newProducts.length} produto(s) que não estão cadastrados. Deseja criar automaticamente?
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-64 overflow-auto space-y-2">
            {newProducts.map((product, index) => (
              <div key={index} className="flex items-center gap-3 p-2 border rounded-lg">
                <Checkbox
                  checked={selectedNewProducts.includes(product.name)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedNewProducts([...selectedNewProducts, product.name]);
                    } else {
                      setSelectedNewProducts(selectedNewProducts.filter(n => n !== product.name));
                    }
                  }}
                />
                <div className="flex-1">
                  <span className="text-sm block">{product.name}</span>
                </div>
                <Select
                  value={product.sector}
                  onValueChange={(value) => {
                    const updated = [...newProducts];
                    updated[index].sector = value;
                    setNewProducts(updated);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(sector => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={product.unit || "unidade"}
                  onValueChange={(value) => {
                    const updated = [...newProducts];
                    updated[index].unit = value;
                    setNewProducts(updated);
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="pacotes">Pacotes</SelectItem>
                    <SelectItem value="kilo">Kilo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewProductsDialog(false)}>
              Ignorar
            </Button>
            <Button onClick={handleCreateNewProducts} disabled={selectedNewProducts.length === 0}>
              Criar {selectedNewProducts.length} Produto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}