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
    const { date } = body;

    if (!date) {
      return Response.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const sql = postgres(connectionString);
    
    try {
      console.log(`📅 Buscando semana para data: ${date}`);
      
      const result = await sql`
        SELECT numero_semana, ano, data_inicio, data_fim
        FROM semanas
        WHERE ${date}::date BETWEEN data_inicio AND data_fim
        LIMIT 1
      `;
      
      await sql.end();

      if (result.length === 0) {
        console.warn(`⚠️ Nenhuma semana encontrada para data: ${date}`);
        return Response.json({ 
          error: 'Nenhuma semana encontrada para esta data',
          numero_semana: 1,
          ano: 2026
        }, { status: 404 });
      }

      console.log(`✅ Semana encontrada:`, result[0]);
      
      return Response.json(result[0]);
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar semana atual:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});