import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function DataReset({ onComplete }) {
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleReset = async () => {
    if (confirmText !== "EXCLUIR TUDO") {
      toast.error("Digite 'EXCLUIR TUDO' para confirmar");
      return;
    }

    setLoading(true);

    try {
      // Deletar todos os registros
      const [products, sales, losses, plans, production] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.SalesRecord.list(),
        base44.entities.LossRecord.list(),
        base44.entities.ProductionPlan.list(),
        base44.entities.ProductionRecord.list()
      ]);

      const deletePromises = [];

      // Deletar produtos
      products.forEach(p => {
        deletePromises.push(base44.entities.Product.delete(p.id));
      });

      // Deletar registros de vendas
      sales.forEach(s => {
        deletePromises.push(base44.entities.SalesRecord.delete(s.id));
      });

      // Deletar registros de perdas
      losses.forEach(l => {
        deletePromises.push(base44.entities.LossRecord.delete(l.id));
      });

      // Deletar planos de produção
      plans.forEach(p => {
        deletePromises.push(base44.entities.ProductionPlan.delete(p.id));
      });

      // Deletar registros de produção
      production.forEach(p => {
        deletePromises.push(base44.entities.ProductionRecord.delete(p.id));
      });

      await Promise.all(deletePromises);

      toast.success("Todos os dados foram excluídos com sucesso");
      setConfirmDialog(false);
      setConfirmText("");
      onComplete?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-2 border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Zona de Perigo
          </CardTitle>
          <CardDescription className="text-red-700">
            Esta ação é irreversível e excluirá permanentemente todos os dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="destructive" 
            onClick={() => setConfirmDialog(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Todos os Produtos e Registros
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              Confirmar Exclusão Total
            </DialogTitle>
            <DialogDescription className="text-base pt-2 space-y-3">
              <p className="font-semibold text-red-800">
                ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!
              </p>
              <p>Serão excluídos permanentemente:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todos os produtos cadastrados</li>
                <li>Todos os registros de vendas</li>
                <li>Todos os registros de perdas</li>
                <li>Todos os planos de produção</li>
                <li>Todos os registros de produção</li>
              </ul>
              <p className="pt-2 text-slate-700">
                Digite <strong className="font-mono bg-slate-100 px-2 py-0.5 rounded">EXCLUIR TUDO</strong> para confirmar:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Digite EXCLUIR TUDO"
              />
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setConfirmDialog(false);
                setConfirmText("");
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReset}
              disabled={loading || confirmText !== "EXCLUIR TUDO"}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Confirmar Exclusão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}