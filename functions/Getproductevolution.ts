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

    if (!productCode && !productName) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const sql = neon(connectionString);

    let evolution = [];

    if (type === 'sales') {
      let rows;
      if (productCode) {
        rows = await sql(
          `SELECT data::text as data,
                  SUM(valor_total) AS valor,
                  SUM(quantidade_total) AS quantidade
           FROM vendas
           WHERE produto_codigo = $1
             AND data >= $2::date
             AND data <= $3::date
           GROUP BY data
           ORDER BY data`,
          [productCode, startDate, endDate]
        );
      } else {
        rows = await sql(
          `SELECT v.data::text as data,
                  SUM(v.valor_total) AS valor,
                  SUM(v.quantidade_total) AS quantidade
           FROM vendas v
           LEFT JOIN produtos p ON v.produto_codigo = p.codigo
           WHERE LOWER(TRIM(COALESCE(p.descricao, v.produto_descricao))) = $1
             AND v.data >= $2::date
             AND v.data <= $3::date
           GROUP BY v.data
           ORDER BY v.data`,
          [productName, startDate, endDate]
        );
      }
      evolution = rows.map(r => ({
        data: r.data,
        valor: parseFloat(r.valor || 0),
        quantidade: parseFloat(r.quantidade || 0)
      }));

    } else {
      let rows;
      if (productCode) {
        rows = await sql(
          `SELECT data::text as data,
                  SUM(valor_total_venda) AS valor,
                  SUM(quantidade) AS quantidade
           FROM perdas
           WHERE produto_codigo = $1
             AND data >= $2::date
             AND data <= $3::date
           GROUP BY data
           ORDER BY data`,
          [productCode, startDate, endDate]
        );
      } else {
        rows = await sql(
          `SELECT p2.data::text as data,
                  SUM(p2.valor_total_venda) AS valor,
                  SUM(p2.quantidade) AS quantidade
           FROM perdas p2
           LEFT JOIN produtos p ON p2.produto_codigo = p.codigo
           WHERE LOWER(TRIM(COALESCE(p.descricao, p2.produto_descricao))) = $1
             AND p2.data >= $2::date
             AND p2.data <= $3::date
           GROUP BY p2.data
           ORDER BY p2.data`,
          [productName, startDate, endDate]
        );
      }
      evolution = rows.map(r => ({
        data: r.data,
        valor: parseFloat(r.valor || 0),
        quantidade: parseFloat(r.quantidade || 0)
      }));
    }

    const stats = {
      totalValor:      evolution.reduce((s, r) => s + r.valor, 0),
      totalQuantidade: evolution.reduce((s, r) => s + r.quantidade, 0)
    };

    console.log(`✅ Evolução do produto ${productCode || productName}: ${evolution.length} registros, tipo=${type}`);

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