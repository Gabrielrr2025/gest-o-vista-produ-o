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
    
    const [vendaColumns, perdaColumns, vendaSample, perdaSample] = await Promise.all([
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendas' ORDER BY ordinal_position`,
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'perdas' ORDER BY ordinal_position`,
      sql`SELECT * FROM vendas LIMIT 1`,
      sql`SELECT * FROM perdas LIMIT 1`
    ]);

    return Response.json({
      vendas_columns: vendaColumns,
      perdas_columns: perdaColumns,
      venda_sample: vendaSample,
      perda_sample: perdaSample
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});