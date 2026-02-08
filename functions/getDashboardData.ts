import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate, sector = 'all' } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    // PEGAR CONNECTION STRING DIRETA
    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📊 Buscando dados: ${startDate} a ${endDate}, setor=${sector}`);

    // Query 1: Top 5 mais vendidos
    const topSalesQuery = sector !== 'all'
      ? `SELECT p.nome as produto, SUM(v.quantidade) as total_vendas
         FROM vendas v
         JOIN produtos p ON v.produto_id = p.id
         WHERE v.data BETWEEN $1 AND $2 AND p.setor = $3
         GROUP BY p.nome
         ORDER BY total_vendas DESC
         LIMIT 5`
      : `SELECT p.nome as produto, SUM(v.quantidade) as total_vendas
         FROM vendas v
         JOIN produtos p ON v.produto_id = p.id
         WHERE v.data BETWEEN $1 AND $2
         GROUP BY p.nome
         ORDER BY total_vendas DESC
         LIMIT 5`;

    const topSalesParams = sector !== 'all' ? [startDate, endDate, sector] : [startDate, endDate];
    const topSalesResult = await sql(topSalesQuery, topSalesParams);

    // Query 2: Análise de perdas
    const lossAnalysisQuery = sector !== 'all'
      ? `SELECT p.nome as produto, 
                SUM(pe.quantidade) as perda,
                (SELECT SUM(v.quantidade) 
                 FROM vendas v 
                 WHERE v.produto_id = p.id 
                   AND v.data BETWEEN $1 AND $2) as venda
         FROM perdas pe
         JOIN produtos p ON pe.produto_id = p.id
         WHERE pe.data BETWEEN $1 AND $2 AND p.setor = $3
         GROUP BY p.id, p.nome
         HAVING SUM(pe.quantidade) > 0
         ORDER BY perda DESC`
      : `SELECT p.nome as produto,
                SUM(pe.quantidade) as perda,
                (SELECT SUM(v.quantidade) 
                 FROM vendas v 
                 WHERE v.produto_id = p.id 
                   AND v.data BETWEEN $1 AND $2) as venda
         FROM perdas pe
         JOIN produtos p ON pe.produto_id = p.id
         WHERE pe.data BETWEEN $1 AND $2
         GROUP BY p.id, p.nome
         HAVING SUM(pe.quantidade) > 0
         ORDER BY perda DESC`;

    const lossAnalysisParams = sector !== 'all' ? [startDate, endDate, sector] : [startDate, endDate];
    const lossAnalysisResult = await sql(lossAnalysisQuery, lossAnalysisParams);

    console.log('✅ Dados retornados:', {
      topSales: topSalesResult.length,
      lossAnalysis: lossAnalysisResult.length
    });

    return Response.json({
      topSales: topSalesResult,
      lossAnalysis: lossAnalysisResult
    });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});