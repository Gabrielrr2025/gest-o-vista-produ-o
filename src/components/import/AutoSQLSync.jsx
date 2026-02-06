import React, { useEffect, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Database, Loader2, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export default function AutoSQLSync({ startDate, endDate, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [cacheKey, setCacheKey] = useState(null);

  const shouldSync = () => {
    // Criar chave de cache baseada nas datas
    const key = `${startDate}-${endDate}`;
    
    // Verificar se já sincronizou recentemente
    if (cacheKey === key && lastSync) {
      const timeSinceSync = Date.now() - lastSync;
      return timeSinceSync > CACHE_DURATION;
    }
    return true;
  };

  const performSync = async (force = false) => {
    if (!force && !shouldSync()) {
      return;
    }

    setSyncing(true);
    try {
      const response = await base44.functions.invoke('fetchSQLData', {
        startDate: startDate || format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: endDate || format(new Date(), 'yyyy-MM-dd')
      });

      if (!response.data.success) {
        throw new Error(response.data.errorMessage || 'Erro ao buscar dados');
      }

      const { salesData, lossData } = response.data;

      // Buscar produtos para mapeamento
      const products = await base44.entities.Product.list();
      const productMap = new Map(products.map(p => [p.name.toLowerCase(), p]));

      // Importar vendas
      for (const sale of salesData) {
        const product = productMap.get(sale.product_name.toLowerCase());
        
        // Verificar se já existe registro
        const existing = await base44.entities.SalesRecord.filter({
          product_name: sale.product_name,
          date: sale.date
        });

        const saleRecord = {
          product_id: product?.id || null,
          product_name: sale.product_name,
          sector: sale.sector,
          quantity: sale.quantity,
          date: sale.date,
          week_number: sale.week_number,
          month: sale.month,
          year: sale.year
        };

        if (existing.length === 0) {
          await base44.entities.SalesRecord.create(saleRecord);
        }
      }

      // Importar perdas
      for (const loss of lossData) {
        const product = productMap.get(loss.product_name.toLowerCase());
        
        // Verificar se já existe registro
        const existing = await base44.entities.LossRecord.filter({
          product_name: loss.product_name,
          date: loss.date
        });

        const lossRecord = {
          product_id: product?.id || null,
          product_name: loss.product_name,
          sector: loss.sector,
          quantity: loss.quantity,
          date: loss.date,
          week_number: loss.week_number,
          month: loss.month,
          year: loss.year
        };

        if (existing.length === 0) {
          await base44.entities.LossRecord.create(lossRecord);
        }
      }

      const key = `${startDate}-${endDate}`;
      setCacheKey(key);
      setLastSync(Date.now());
      
      if (force) {
        toast.success('Dados atualizados');
      }
      
      onSyncComplete?.();
    } catch (error) {
      console.error('Erro na sincronização:', error);
      if (force) {
        toast.error('Erro ao atualizar dados');
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    performSync();
  }, [startDate, endDate]);

  return (
    <div className="flex items-center gap-2">
      {syncing ? (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-tertiary))]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Carregando dados...</span>
        </div>
      ) : lastSync ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-[hsl(var(--text-tertiary))]">
            <Database className="w-3 h-3" />
            <span>Última atualização: {format(lastSync, 'HH:mm', { locale: ptBR })}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => performSync(true)}
            title="Atualizar dados"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}