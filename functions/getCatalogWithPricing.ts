import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });

    const sql = neon(connectionString);

    // Garantir colunas de custo e preço
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC(10,4) DEFAULT NULL`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(10,4) DEFAULT NULL`;

    const body = await req.json().catch(() => ({}));
    const { startDate = '2026-01-01', endDate = '2026-12-31' } = body;

    // Buscar todos os produtos + vendas do período para curva ABC
    const [products, salesByProduct] = await Promise.all([
      sql`
        SELECT 
          p.id, p.codigo, p.descricao, p.departamento_desc as setor, p.unidade,
          prod.custo, prod.preco_venda, prod.status as planejamento_status,
          prod.id as planejamento_id
        FROM produtos p
        LEFT JOIN produtos prod ON p.codigo = prod.codigo AND prod.status IN ('ativo', 'inativo')
        ORDER BY p.departamento_desc, p.descricao
      `,
      sql`
        SELECT 
          v.produto_codigo as codigo,
          SUM(v.valor_total) as total_vendas,
          SUM(v.quantidade_total) as total_qty
        FROM vendas v
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY v.produto_codigo
        ORDER BY total_vendas DESC
      `
    ]);

    // Calcular curva ABC
    const totalGeral = salesByProduct.reduce((s, p) => s + parseFloat(p.total_vendas || 0), 0);
    let acumulado = 0;
    const abcMap = new Map();
    salesByProduct.forEach(p => {
      acumulado += parseFloat(p.total_vendas || 0);
      const pct = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
      abcMap.set(String(p.codigo), {
        total_vendas: parseFloat(p.total_vendas || 0),
        total_qty: parseFloat(p.total_qty || 0),
        curva: pct <= 70 ? 'A' : pct <= 90 ? 'B' : 'C'
      });
    });

    // Buscar lista de produtos distintos da tabela de vendas (produtos reais com histórico)
    const allProducts = await sql`
      SELECT DISTINCT 
        v.produto_codigo as codigo,
        COALESCE(p.descricao, v.produto_descricao) as descricao,
        COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
        COALESCE(p.unidade, 'UN') as unidade,
        prod.id as prod_id,
        prod.custo,
        prod.preco_venda,
        prod.status as planejamento_status
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_codigo = p.codigo
      LEFT JOIN produtos prod ON v.produto_codigo = prod.codigo
      ORDER BY setor, descricao
    `;

    const result = allProducts.map(p => {
      const abc = abcMap.get(String(p.codigo)) || { total_vendas: 0, total_qty: 0, curva: null };
      const custo = parseFloat(p.custo || 0);
      const preco = parseFloat(p.preco_venda || 0);
      const margem = preco > 0 && custo > 0 ? ((preco - custo) / preco) * 100 : null;
      return {
        codigo: p.codigo,
        nome: p.descricao,
        setor: p.setor,
        unidade: p.unidade,
        custo: custo || null,
        preco_venda: preco || null,
        margem,
        curva_abc: abc.curva,
        total_vendas: abc.total_vendas,
        total_qty: abc.total_qty,
        no_planejamento: !!p.prod_id && p.planejamento_status === 'ativo',
        planejamento_id: p.prod_id || null
      };
    });

    return Response.json({ success: true, products: result, period: { startDate, endDate } });

  } catch (error) {
    console.error('❌ Erro getCatalogWithPricing:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});