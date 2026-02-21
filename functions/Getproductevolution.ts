import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import postgres from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produtoId, startDate, endDate, type = 'sales' } = await req.json();

    if (!produtoId || !startDate || !endDate) {
      return Response.json({ 
        error: 'Missing required fields: produtoId, startDate, endDate' 
      }, { status: 400 });
    }

    const connectionString = Deno.env.get("POSTGRES_CONNECTION_URL");
    if (!connectionString) {
      return Response.json({ error: 'Database not configured' }, { status: 500 });
    }

    const sql = postgres(connectionString);

    try {
      const tableName = type === 'sales' ? 'vendas' : 'perdas';
      
      // Buscar evolução diária do produto
      const evolution = await sql`
        SELECT 
          data,
          SUM(quantidade) as total_quantidade,
          SUM(quantidade * preco) as total_valor
        FROM ${sql(tableName)}
        WHERE produto_id = ${produtoId}
          AND data >= ${startDate}::date
          AND data <= ${endDate}::date
        GROUP BY data
        ORDER BY data
      `;

      // Calcular totais
      const totalQty = evolution.reduce((sum, row) => sum + parseFloat(row.total_quantidade || 0), 0);
      const totalValue = evolution.reduce((sum, row) => sum + parseFloat(row.total_valor || 0), 0);

      return Response.json({
        success: true,
        evolution: evolution,
        totalQty,
        totalValue
      });

    } finally {
      await sql.end();
    }

  } catch (error) {
    console.error('Error in getProductEvolution:', error);
    return Response.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
});