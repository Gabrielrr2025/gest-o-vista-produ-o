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

    // Buscar vendas por produto para curva ABC
    const salesByProduct = await sql`
      SELECT 
        v.produto_codigo as codigo,
        SUM(v.valor_total) as total_vendas,
        SUM(v.quantidade_total) as total_qty
      FROM vendas v
      WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY v.produto_codigo
      ORDER BY total_vendas DESC
    `;

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

    // Buscar todos os produtos distintos com histórico de vendas
    const allProducts = await sql`
      SELECT DISTINCT 
        v.produto_codigo as codigo,
        COALESCE(p.descricao, v.produto_descricao) as descricao,
        COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
        COALESCE(p.unidade, 'UN') as unidade,
        p.custo,
        p.preco_venda
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_codigo = p.codigo
      ORDER BY setor, descricao
    `;

    // Buscar produtos que estão no planejamento (tabela própria do base44 via SDK)
    const planejamentoProds = await base44.asServiceRole.entities.Product.list();
    const planejamentoSet = new Set((planejamentoProds || []).map(p => String(p.code || '').toLowerCase()));

    const result = allProducts.map(p => {
      const abc = abcMap.get(String(p.codigo)) || { total_vendas: 0, total_qty: 0, curva: null };
      const custo = p.custo != null ? parseFloat(p.custo) : null;
      const preco = p.preco_venda != null ? parseFloat(p.preco_venda) : null;
      const margem = preco != null && custo != null && preco > 0 ? ((preco - custo) / preco) * 100 : null;
      return {
        codigo: p.codigo,
        nome: p.descricao,
        setor: p.setor,
        unidade: p.unidade,
        custo,
        preco_venda: preco,
        margem,
        curva_abc: abc.curva,
        total_vendas: abc.total_vendas,
        total_qty: abc.total_qty,
        no_planejamento: planejamentoSet.has(String(p.codigo).toLowerCase())
      };
    });

    return Response.json({ success: true, products: result, period: { startDate, endDate } });

  } catch (error) {
    console.error('❌ Erro getCatalogWithPricing:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});