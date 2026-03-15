import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não encontrada' }, { status: 500 });
    }

    const sql = neon(connectionString);
    
    const [produtosColumns, produtoSample] = await Promise.all([
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'produtos' ORDER BY ordinal_position`,
      sql`SELECT * FROM produtos LIMIT 1`
    ]);

    return Response.json({
      produtos_columns: produtosColumns,
      produto_sample: produtoSample
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});