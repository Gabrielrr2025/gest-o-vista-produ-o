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

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL') || Deno.env.get('DATABASE_URL');

    console.log('🔍 Connection string existe?', !!connectionString);
    console.log('🔍 Primeiros 30 chars:', connectionString?.substring(0, 30));

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
        console.log('⚠️ Nenhuma semana encontrada, usando padrão');
        return Response.json({ 
          numero_semana: 6,
          ano: 2026,
          data_inicio: '2026-02-03',
          data_fim: '2026-02-09'
        });
      }

      console.log(`✅ Semana encontrada:`, result[0]);
      
      return Response.json(result[0]);
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar semana atual:', error.message);
    console.error('❌ Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});