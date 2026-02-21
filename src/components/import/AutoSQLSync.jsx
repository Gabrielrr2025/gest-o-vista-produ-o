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
    const key = `${startDate}-${endDate}`;

    if (cacheKey === key && lastSync) {
      const timeSinceSync = Date.now() - lastSync;
      return timeSinceSync > CACHE_DURATION;
    }
    return true;
  };

  const performSync = async (force = false) => {
    if (!force && !shouldSync()) return;

    setSyncing(true);
    try {
      const response = await base44.functions.invoke('fetchSQLData', {
        startDate: startDate || format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: endDate || format(new Date(), 'yyyy-MM-dd')
      });

      // ✅ Aqui é o mais importante: mostrar o erro real do backend
      if (!response?.data?.success) {
        throw new Error(response?.data?.error || response?.data?.errorMessage || 'Erro ao buscar dados');
      }

      const { salesData, lossData } = response.data;

      const products = await base44.entities.Product.list();

      const productByCode = new Map(
        products.filter(p => p.code).map(p => [p.code.toLowerCase().trim(), p])
      );
      const productByName = new Map(
        products.map(p => [p.name.toLowerCase().trim(), p])
      );

      const findProduct = (productCode, productName) => {
        if (productCode) {
          const byCode = productByCode.get(productCode.toLowerCase().trim());
          if (byCode) return byCode;
        }
        if (productName) {
          const byName = productByName.get(productName.toLowerCase().trim());
          if (byName) return byName;
        }
        return null;
      };

      // Vendas
      const salesToCreate = [];
      for (const sale of salesData) {
        const product = findProduct(sale.product_code, sale.product_name);

        const existing = await base44.entities.SalesRecord.filter({
          product_name: sale.product_name,
          date: sale.date
        });

        if (existing.length === 0) {
          salesToCreate.push({
            product_id: product?.id || null,
            product_name: sale.product_name,
            sector: sale.sector,
            quantity: sale.quantity,
            date: sale.date,
            week_number: sale.week_number,
            month: sale.month,
            year: sale.year
          });
        } else if (existing[0].product_id !== product?.id && product) {
          await base44.entities.SalesRecord.update(existing[0].id, {
            product_id: product.id
          });
        }
      }

      if (salesToCreate.length > 0) {
        await base44.entities.SalesRecord.bulkCreate(salesToCreate);
      }

      // Perdas
      const lossesToCreate = [];
      for (const loss of lossData) {
        const product = findProduct(loss.product_code, loss.product_name);

        const existing = await base44.entities.LossRecord.filter({
          product_name: loss.product_name,
          date: loss.date
        });

        if (existing.length === 0) {
          lossesToCreate.push({
            product_id: product?.id || null,
            product_name: loss.product_name,
            sector: loss.sector,
            quantity: loss.quantity,
            date: loss.date,
            week_number: loss.week_number,
            month: loss.month,
            year: loss.year
          });
        } else if (existing[0].product_id !== product?.id && product) {
          await base44.entities.LossRecord.update(existing[0].id, {
            product_id: product.id
          });
        }
      }

      if (lossesToCreate.length > 0) {
        await base44.entities.LossRecord.bulkCreate(lossesToCreate);
      }

      const key = `${startDate}-${endDate}`;
      setCacheKey(key);
      setLastSync(Date.now());

      if (force) toast.success('Dados atualizados');

      onSyncComplete?.();
    } catch (error) {
      console.error('Erro na sincronização:', error);
      if (force) toast.error(error?.message || 'Erro ao atualizar dados');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    performSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
