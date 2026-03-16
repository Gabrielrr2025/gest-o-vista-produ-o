import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import SectorBadge from '../common/SectorBadge';

export default function FavoriteProductsPanel({ onProductClick }) {
  const [expanded, setExpanded] = useState(true);

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => base44.entities.FavoriteProduct.list('-created_date', 50),
  });

  if (isLoading) return null;
  if (favorites.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <CardTitle className="text-sm font-semibold text-amber-900">
              Produtos Favoritos
            </CardTitle>
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              {favorites.length}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {favorites.map(fav => (
              <button
                key={fav.id}
                onClick={() => onProductClick?.(fav.product_id, fav.product_name)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm hover:bg-amber-50 hover:border-amber-400 transition-all shadow-sm group"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium text-slate-700 group-hover:text-slate-900">{fav.product_name}</span>
                {fav.sector && <SectorBadge sector={fav.sector} className="text-[10px] px-1.5 py-0.5" />}
                <TrendingUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">
            Clique em qualquer produto para abrir a análise de evolução
          </p>
        </CardContent>
      )}
    </Card>
  );
}