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
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📥 Buscando planejamento salvo: ${startDate} a ${endDate}`);

    // Buscar todos os planejamentos da semana
    const result = await sql`
      SELECT 
        p.id,
        p.produto_id,
        p.data,
        p.quantidade_planejada,
        p.updated_at,
        prod.nome as produto_nome
      FROM planejamento p
      JOIN produtos prod ON p.produto_id = prod.id
      WHERE p.data BETWEEN ${startDate} AND ${endDate}
      ORDER BY p.data, prod.nome
    `;

    console.log(`✅ ${result.length} registros encontrados`);

    return Response.json({
      planejamentos: result
    });

  } catch (error) {
    console.error('❌ Erro ao buscar planejamento:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
