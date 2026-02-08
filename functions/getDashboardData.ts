import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg@8.11.3';

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

    // MONTANDO CONNECTION STRING
    const host = Deno.env.get('POSTGRES_HOST');
    const port = Deno.env.get('POSTGRES_PORT');
    const dbUser = Deno.env.get('POSTGRES_USER');
    const password = Deno.env.get('POSTGRES_PASSWORD');
    const database = Deno.env.get('POSTGRES_DATABASE');

    console.log('🔍 Variáveis:', { host, port, dbUser: !!dbUser, password: !!password, database });

    if (!host || !port || !dbUser || !password || !database) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const { Client } = pg;
    const client = new Client({
      host,
      port: parseInt(port),
      user: dbUser,
      password,
      database,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Conectado ao banco');

    try {
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
      const topSalesResult = await client.query(topSalesQuery, topSalesParams);

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
      const lossAnalysisResult = await client.query(lossAnalysisQuery, lossAnalysisParams);

      await client.end();

      console.log('✅ Dados retornados:', {
        topSales: topSalesResult.rows.length,
        lossAnalysis: lossAnalysisResult.rows.length
      });

      return Response.json({
        topSales: topSalesResult.rows,
        lossAnalysis: lossAnalysisResult.rows
      });
    } catch (error) {
      await client.end();
      throw error;
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('❌ Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});