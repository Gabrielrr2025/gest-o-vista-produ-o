import React, { useEffect, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Database, Loader2, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export default function SQLDataProvider({ startDate, endDate, onDataLoaded, showLastUpdate = true }) {
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [cacheKey, setCacheKey] = useState(null);

  const shouldFetch = () => {
    const key = `${startDate}-${endDate}`;
    if (cacheKey === key && lastSync) {
      const timeSinceSync = Date.now() - lastSync;
      return timeSinceSync > CACHE_DURATION;
    }
    return true;
  };

  const fetchData = async (force = false) => {
    if (!force && !shouldFetch()) {
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('fetchSQLData', {
        startDate: startDate || format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: endDate || format(new Date(), 'yyyy-MM-dd')
      });

      if (!response.data.success) {
        throw new Error(response.data.errorMessage || 'Erro ao buscar dados');
      }

      const { salesData, lossData } = response.data;

      // Buscar produtos para enriquecer os dados com product_id
      const products = await base44.entities.Product.list();
      const productByCode = new Map(products.filter(p => p.code).map(p => [p.code.toLowerCase().trim(), p]));
      const productByName = new Map(products.map(p => [p.name.toLowerCase().trim(), p]));

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

      // Enriquecer dados com product_id
      const enrichedSales = salesData.map(sale => {
        const product = findProduct(sale.product_code, sale.product_name);
        return {
          ...sale,
          product_id: product?.id || null
        };
      });

      const enrichedLosses = lossData.map(loss => {
        const product = findProduct(loss.product_code, loss.product_name);
        return {
          ...loss,
          product_id: product?.id || null
        };
      });

      const key = `${startDate}-${endDate}`;
      setCacheKey(key);
      setLastSync(Date.now());

      if (force) {
        toast.success('Dados atualizados');
      }

      onDataLoaded?.({ sales: enrichedSales, losses: enrichedLosses });
    } catch (error) {
      console.error('Erro ao buscar dados SQL:', error);
      if (force) {
        toast.error('Erro ao atualizar dados');
      }
      onDataLoaded?.({ sales: [], losses: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  if (!showLastUpdate) return null;

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-tertiary))]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Carregando...</span>
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
            onClick={() => fetchData(true)}
            title="Atualizar dados"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}