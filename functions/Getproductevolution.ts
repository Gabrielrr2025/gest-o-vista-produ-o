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

    const sql = neon(connectionString);

    let evolution = [];
    let stats = { totalValor: 0, totalQuantidade: 0 };

    if (type === 'sales') {
      // vendas: produto_codigo, valor_total, quantidade_total, data
      const rows = await sql`
        SELECT
          data,
          SUM(valor_total)      AS valor,
          SUM(quantidade_total) AS quantidade
        FROM vendas
        WHERE produto_codigo = ${produtoId}
          AND data >= ${startDate}::date
          AND data <= ${endDate}::date
        GROUP BY data
        ORDER BY data
      `;

      evolution = rows.map(r => ({
        data: r.data,
        valor: parseFloat(r.valor || 0),
        quantidade: parseFloat(r.quantidade || 0)
      }));
    } else {
      // perdas: produto_codigo, valor_total_venda, quantidade, data
      const rows = await sql`
        SELECT
          data,
          SUM(valor_total_venda) AS valor,
          SUM(quantidade)        AS quantidade
        FROM perdas
        WHERE produto_codigo = ${produtoId}
          AND data >= ${startDate}::date
          AND data <= ${endDate}::date
        GROUP BY data
        ORDER BY data
      `;

      evolution = rows.map(r => ({
        data: r.data,
        valor: parseFloat(r.valor || 0),
        quantidade: parseFloat(r.quantidade || 0)
      }));
    }

    stats.totalValor     = evolution.reduce((s, r) => s + r.valor, 0);
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