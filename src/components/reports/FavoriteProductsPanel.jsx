import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Star, TrendingUp } from 'lucide-react';
import SectorBadge from '../common/SectorBadge';

export default function FavoriteProductsPanel({ onProductClick }) {
  const [open, setOpen] = useState(false);

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => base44.entities.FavoriteProduct.list('-created_date', 50),
  });

  if (favorites.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-400">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          Favoritos
          <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{favorites.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Produtos Favoritos</p>
        <div className="space-y-1">
          {favorites.map(fav => (
            <button
              key={fav.id}
              onClick={() => { onProductClick?.(fav.product_id, fav.product_name); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-amber-50 transition-colors text-left group"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
              <span className="font-medium text-slate-700 group-hover:text-slate-900 flex-1 truncate">{fav.product_name}</span>
              {fav.sector && <SectorBadge sector={fav.sector} className="text-[10px] px-1.5 py-0.5" />}
              <TrendingUp className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}