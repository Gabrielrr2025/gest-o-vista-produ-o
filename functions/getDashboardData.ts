import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import postgres from 'npm:postgres@3.4.4';

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

    // MONTANDO CONNECTION STRING A PARTIR DAS VARIÁVEIS SEPARADAS
    const host = Deno.env.get('POSTGRES_HOST');
    const port = Deno.env.get('POSTGRES_PORT');
    const dbUser = Deno.env.get('POSTGRES_USER');
    const password = Deno.env.get('POSTGRES_PASSWORD');
    const database = Deno.env.get('POSTGRES_DATABASE');

    const connectionString = `postgresql://${dbUser}:${password}@${host}:${port}/${database}`;

    console.log('🔍 Connection construída:', `postgresql://${dbUser}:****@${host}:${port}/${database}`);

    if (!host || !port || !dbUser || !password || !database) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const sql = postgres(connectionString);

    try {
      console.log(`📊 Buscando dados do Dashboard: ${startDate} a ${endDate}, setor=${sector}`);

      // Query 1: Top 5 mais vendidos
      const topSalesResult = sector !== 'all'
        ? await sql`
            SELECT 
              p.nome as produto,
              SUM(v.quantidade) as total_vendas
            FROM vendas v
            JOIN produtos p ON v.produto_id = p.id
            WHERE v.data BETWEEN ${startDate} AND ${endDate}
              AND p.setor = ${sector}
            GROUP BY p.nome
            ORDER BY total_vendas DESC
            LIMIT 5
          `
        : await sql`
            SELECT 
              p.nome as produto,
              SUM(v.quantidade) as total_vendas
            FROM vendas v
            JOIN produtos p ON v.produto_id = p.id
            WHERE v.data BETWEEN ${startDate} AND ${endDate}
            GROUP BY p.nome
            ORDER BY total_vendas DESC
            LIMIT 5
          `;

      // Query 2: Análise de perdas
      const lossAnalysisResult = sector !== 'all'
        ? await sql`
            SELECT 
              p.nome as produto,
              SUM(pe.quantidade) as perda,
              (SELECT SUM(v.quantidade) 
               FROM vendas v 
               WHERE v.produto_id = p.id 
                 AND v.data BETWEEN ${startDate} AND ${endDate}) as venda
            FROM perdas pe
            JOIN produtos p ON pe.produto_id = p.id
            WHERE pe.data BETWEEN ${startDate} AND ${endDate}
              AND p.setor = ${sector}
            GROUP BY p.id, p.nome
            HAVING SUM(pe.quantidade) > 0
            ORDER BY perda DESC
          `
        : await sql`
            SELECT 
              p.nome as produto,
              SUM(pe.quantidade) as perda,
              (SELECT SUM(v.quantidade) 
               FROM vendas v 
               WHERE v.produto_id = p.id 
                 AND v.data BETWEEN ${startDate} AND ${endDate}) as venda
            FROM perdas pe
            JOIN produtos p ON pe.produto_id = p.id
            WHERE pe.data BETWEEN ${startDate} AND ${endDate}
            GROUP BY p.id, p.nome
            HAVING SUM(pe.quantidade) > 0
            ORDER BY perda DESC
          `;

      await sql.end();

      console.log('✅ Dados retornados:', {
        topSales: topSalesResult.length,
        lossAnalysis: lossAnalysisResult.length
      });

      return Response.json({
        topSales: topSalesResult,
        lossAnalysis: lossAnalysisResult
      });
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar dados do dashboard:', error.message);
    console.error('❌ Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});