import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produtoId, startDate, endDate, type = 'sales' } = await req.json();

    if (!produtoId || !startDate || !endDate) {
      return Response.json({ error: 'Missing required fields: produtoId, startDate, endDate' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Buscar o produto no Base44 para obter o code (produto_codigo no SQL)
    let productCode = null;
    let productName = null;
    try {
      const product = await base44.asServiceRole.entities.Product.get(produtoId);
      if (product) {
        productCode = product.code ? String(product.code) : null;
        productName = product.name ? product.name.toLowerCase().trim() : null;
      }
    } catch (e) {
      console.warn('Aviso: não foi possível buscar produto no Base44:', e.message);
    }

    const sql = neon(connectionString);

    let evolution = [];
    let stats = { totalValor: 0, totalQuantidade: 0 };

    // Função para gerar cláusula WHERE de produto (por código ou nome)
    const buildRows = async (tableType) => {
      const isVendas = tableType === 'sales';
      const valorCol = isVendas ? 'valor_total' : 'valor_total_venda';
      const qtyCol   = isVendas ? 'quantidade_total' : 'quantidade';
      const tipo     = isVendas ? 'venda' : 'perda';

      // Buscar via VIEW vw_movimentacoes - mesma abordagem do Getplanningdata
      let rows;
      if (productCode) {
        // Busca por código (preferencial)
        rows = await sql(
          `SELECT data::text as data,
                  SUM(${isVendas ? 'valor_total' : 'valor_total'}) AS valor,
                  SUM(quantidade) AS quantidade
           FROM vw_movimentacoes
           WHERE produto_codigo = $1
             AND tipo = $2
             AND data >= $3::date
             AND data <= $4::date
           GROUP BY data
           ORDER BY data`,
          [productCode, tipo, startDate, endDate]
        );
      } else if (productName) {
        // Fallback: busca por nome
        rows = await sql(
          `SELECT data::text as data,
                  SUM(valor_total) AS valor,
                  SUM(quantidade)  AS quantidade
           FROM vw_movimentacoes
           WHERE LOWER(TRIM(produto)) = $1
             AND tipo = $2
             AND data >= $3::date
             AND data <= $4::date
           GROUP BY data
           ORDER BY data`,
          [productName, tipo, startDate, endDate]
        );
      } else {
        rows = [];
      }

      return rows.map(r => ({
        data: r.data,
        valor: parseFloat(r.valor || 0),
        quantidade: parseFloat(r.quantidade || 0)
      }));
    };

    evolution = await buildRows(type);

    stats.totalValor      = evolution.reduce((s, r) => s + r.valor, 0);
    stats.totalQuantidade = evolution.reduce((s, r) => s + r.quantidade, 0);

    return Response.json({
      data: {
        evolution,
        stats
      }
    });

  } catch (error) {
    console.error('❌ Getproductevolution error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});