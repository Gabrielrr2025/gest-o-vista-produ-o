import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { produtoId, startDate, endDate, type = 'sales' } = await req.json();

    if (!produtoId || !startDate || !endDate) {
      return Response.json({ error: 'Missing required fields: produtoId, startDate, endDate' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) return Response.json({ error: 'Database not configured' }, { status: 500 });

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

    if (!productName) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const sql = neon(connectionString);
    console.log(`🔍 Buscando produto: code=${productCode}, name="${productName}", tipo=${type}, período=${startDate} a ${endDate}`);

    let rows = [];

    if (type === 'sales') {
      // Busca na tabela vendas
      if (productCode && /^\d+$/.test(productCode)) {
        rows = await sql(
          `SELECT data::text as data,
                  SUM(valor_total) AS valor,
                  SUM(quantidade) AS quantidade
           FROM vendas
           WHERE produto_codigo = $1
             AND data >= $2::date
             AND data <= $3::date
           GROUP BY data
           ORDER BY data`,
          [parseInt(productCode), startDate, endDate]
        );
      }
      if (rows.length === 0) {
        rows = await sql(
          `SELECT data::text as data,
                  SUM(valor_total) AS valor,
                  SUM(quantidade) AS quantidade
           FROM vendas
           WHERE LOWER(TRIM(produto_descricao)) = $1
             AND data >= $2::date
             AND data <= $3::date
           GROUP BY data
           ORDER BY data`,
          [productName, startDate, endDate]
        );
      }
    } else {
      // Busca na tabela perdas
      if (productCode && /^\d+$/.test(productCode)) {
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
          [parseInt(productCode), startDate, endDate]
        );
      }
      if (rows.length === 0) {
        rows = await sql(
          `SELECT data::text as data,
                  SUM(valor_total_venda) AS valor,
                  SUM(quantidade) AS quantidade
           FROM perdas
           WHERE LOWER(TRIM(produto_descricao)) = $1
             AND data >= $2::date
             AND data <= $3::date
           GROUP BY data
           ORDER BY data`,
          [productName, startDate, endDate]
        );
      }
    }

    console.log(`✅ Encontrados ${rows.length} registros para "${productName}"`);

    const evolution = rows.map(r => ({
      data: r.data,
      valor: parseFloat(r.valor || 0),
      quantidade: parseFloat(r.quantidade || 0)
    }));

    const stats = {
      totalValor: evolution.reduce((s, r) => s + r.valor, 0),
      totalQuantidade: evolution.reduce((s, r) => s + r.quantidade, 0)
    };

    return Response.json({ data: { evolution, stats } });

  } catch (error) {
    console.error('❌ Getproductevolution error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});