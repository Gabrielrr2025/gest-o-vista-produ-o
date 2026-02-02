import React from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProductsManager from "../components/products/ProductsManager";

export default function Products() {
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie o cadastro de produtos por setor</p>
      </div>

      <ProductsManager products={products} onRefresh={handleRefresh} />
    </div>
  );
}