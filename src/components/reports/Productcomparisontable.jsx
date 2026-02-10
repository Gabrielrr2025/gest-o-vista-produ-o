import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ProductComparisonTable({ productsData }) {
  if (!productsData || productsData.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Setor</TableHead>
            <TableHead className="text-right">Total Período</TableHead>
            <TableHead className="text-right">Média/Dia</TableHead>
            <TableHead className="text-right">Pico</TableHead>
            <TableHead className="text-right">Vale</TableHead>
            <TableHead className="text-right">Dias c/ Dados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productsData.map((product, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {product.produto.nome}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{product.produto.setor}</Badge>
              </TableCell>
              <TableCell className="text-right font-semibold">
                R$ {product.stats.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right">
                R$ {product.stats.mediaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right">
                <div>
                  <div className="font-medium text-green-600">
                    R$ {product.stats.pico.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {product.stats.pico.data && (
                    <div className="text-xs text-slate-500">
                      {format(parseISO(product.stats.pico.data), 'dd/MM', { locale: ptBR })}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div>
                  <div className="font-medium text-red-600">
                    R$ {product.stats.vale.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {product.stats.vale.data && (
                    <div className="text-xs text-slate-500">
                      {format(parseISO(product.stats.vale.data), 'dd/MM', { locale: ptBR })}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-slate-600">
                {product.stats.diasComDados}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
