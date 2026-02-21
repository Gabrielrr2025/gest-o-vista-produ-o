import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import postgres from 'npm:postgres@3.4.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    console.log('🔍 Teste 1: Connection string existe?', !!connectionString);
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não encontrada' }, { status: 500 });
    }

    const sql = postgres(connectionString);
    
    console.log('🔍 Teste 2: Objeto SQL criado');
    
    const result = await sql`SELECT COUNT(*) as total FROM produtos`;
    
    console.log('🔍 Teste 3: Query executada:', result);
    
    await sql.end();

    return Response.json({
      success: true,
      total_produtos: result[0].total
    });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('❌ Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});
