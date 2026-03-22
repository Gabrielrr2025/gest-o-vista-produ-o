import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { startDate, endDate } = body;

    const DATABASE_URL = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!DATABASE_URL) {
      return Response.json({ success: false, sales: [], losses: [], error: 'Database URL não configurada' });
    }

    const sql = neon(DATABASE_URL);
    console.log('📊 Buscando dados de vendas e perdas...');

    const dateFilter = startDate && endDate
      ? sql`AND data >= ${startDate}::date AND data <= ${endDate}::date`
      : sql``;

    const [vendas, perdas] = await Promise.all([
      startDate && endDate
        ? sql`SELECT data, produto_descricao as produto, produto_codigo, departamento_descricao as setor, quantidade, valor_total as valor, EXTRACT(week FROM data)::int as numero_semana, EXTRACT(year FROM data)::int as ano FROM vendas WHERE data >= ${startDate}::date AND data <= ${endDate}::date ORDER BY data DESC LIMIT 10000`
        : sql`SELECT data, produto_descricao as produto, produto_codigo, departamento_descricao as setor, quantidade, valor_total as valor, EXTRACT(week FROM data)::int as numero_semana, EXTRACT(year FROM data)::int as ano FROM vendas ORDER BY data DESC LIMIT 10000`,
      startDate && endDate
        ? sql`SELECT data, produto_descricao as produto, produto_codigo, quantidade, valor_total_venda as valor, EXTRACT(week FROM data)::int as numero_semana, EXTRACT(year FROM data)::int as ano FROM perdas WHERE data >= ${startDate}::date AND data <= ${endDate}::date ORDER BY data DESC LIMIT 5000`
        : sql`SELECT data, produto_descricao as produto, produto_codigo, quantidade, valor_total_venda as valor, EXTRACT(week FROM data)::int as numero_semana, EXTRACT(year FROM data)::int as ano FROM perdas ORDER BY data DESC LIMIT 5000`
    ]);

    const salesData = vendas.map(row => ({
      product_name: row.produto,
      product_code: row.produto_codigo || '',
      sector: row.setor,
      quantity: parseFloat(row.quantidade) || 0,
      value: parseFloat(row.valor) || 0,
      date: row.data,
      week_number: row.numero_semana,
      year: row.ano
    }));

    const lossData = perdas.map(row => ({
      product_name: row.produto,
      product_code: row.produto_codigo || '',
      sector: null,
      quantity: parseFloat(row.quantidade) || 0,
      value: parseFloat(row.valor) || 0,
      date: row.data,
      week_number: row.numero_semana,
      year: row.ano
    }));

    console.log(`📊 ${salesData.length} vendas, ${lossData.length} perdas`);

    return Response.json({
      success: true,
      sales: salesData,
      losses: lossData,
      totalRecords: salesData.length + lossData.length
    });

  } catch (error) {
    console.error('=== ERRO fetchSQLData ===', error.message);
    return Response.json({ success: false, sales: [], losses: [], error: error.message });
  }
});