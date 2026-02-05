import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function DataReset({ onComplete }) {
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deletingItems, setDeletingItems] = useState([]);
  const [showAnimation, setShowAnimation] = useState(false);

  const handleReset = async () => {
    if (confirmText !== "EXCLUIR TUDO") {
      toast.error("Digite 'EXCLUIR TUDO' para confirmar");
      return;
    }

    setLoading(true);
    setShowAnimation(true);

    const items = [
      { id: 1, label: "Produtos", icon: "📦" },
      { id: 2, label: "Vendas", icon: "💰" },
      { id: 3, label: "Perdas", icon: "📉" },
      { id: 4, label: "Planos", icon: "📋" },
      { id: 5, label: "Registros", icon: "📊" }
    ];

    try {
      // Animar items caindo
      for (let i = 0; i < items.length; i++) {
        setDeletingItems(prev => [...prev, items[i]]);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Deletar todos os registros
      const [products, sales, losses, plans, production] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.SalesRecord.list(),
        base44.entities.LossRecord.list(),
        base44.entities.ProductionPlan.list(),
        base44.entities.ProductionRecord.list()
      ]);

      // Deletar em lotes para evitar timeout
      const batchSize = 50;
      
      // Deletar registros de produção
      for (let i = 0; i < production.length; i += batchSize) {
        const batch = production.slice(i, i + batchSize);
        await Promise.all(batch.map(p => base44.entities.ProductionRecord.delete(p.id)));
      }

      // Deletar planos de produção
      for (let i = 0; i < plans.length; i += batchSize) {
        const batch = plans.slice(i, i + batchSize);
        await Promise.all(batch.map(p => base44.entities.ProductionPlan.delete(p.id)));
      }

      // Deletar registros de perdas
      for (let i = 0; i < losses.length; i += batchSize) {
        const batch = losses.slice(i, i + batchSize);
        await Promise.all(batch.map(l => base44.entities.LossRecord.delete(l.id)));
      }

      // Deletar registros de vendas
      for (let i = 0; i < sales.length; i += batchSize) {
        const batch = sales.slice(i, i + batchSize);
        await Promise.all(batch.map(s => base44.entities.SalesRecord.delete(s.id)));
      }

      // Deletar produtos
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await Promise.all(batch.map(p => base44.entities.Product.delete(p.id)));
      }

      // Deletar eventos de calendário e configurações
      const [events, configs] = await Promise.all([
        base44.entities.CalendarEvent.list(),
        base44.entities.SystemConfig.list()
      ]);

      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        await Promise.all(batch.map(e => base44.entities.CalendarEvent.delete(e.id)));
      }

      for (let i = 0; i < configs.length; i += batchSize) {
        const batch = configs.slice(i, i + batchSize);
        await Promise.all(batch.map(c => base44.entities.SystemConfig.delete(c.id)));
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success("Todos os dados foram excluídos com sucesso");
      setConfirmDialog(false);
      setConfirmText("");
      setShowAnimation(false);
      setDeletingItems([]);
      onComplete?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir dados");
      setShowAnimation(false);
      setDeletingItems([]);
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              Confirmar Exclusão Total
            </DialogTitle>
          </DialogHeader>

          {!showAnimation ? (
            <>
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
            </>
          ) : (
            <div className="h-80 relative overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Trash2 className="w-16 h-16 text-slate-400" />
                </motion.div>
              </div>
              
              <AnimatePresence>
                {deletingItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ 
                      x: Math.random() * 300 - 150,
                      y: -50,
                      rotate: 0,
                      opacity: 1
                    }}
                    animate={{ 
                      y: 350,
                      rotate: Math.random() * 360 - 180,
                      opacity: 0
                    }}
                    transition={{ 
                      duration: 1.5,
                      ease: "easeIn"
                    }}
                    className="absolute left-1/2 top-0"
                  >
                    <div className="bg-white border-2 border-slate-300 rounded-lg px-4 py-2 shadow-lg">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="ml-2 text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-sm text-slate-600 font-medium">
                  {deletingItems.length < 5 ? "Excluindo dados..." : "✓ Exclusão Concluída"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}