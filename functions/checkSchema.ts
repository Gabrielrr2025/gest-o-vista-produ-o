import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    const sql = neon(connectionString);

    const [vendasCols, perdasSample, vendasSample] = await Promise.all([
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendas' ORDER BY ordinal_position`,
      sql`SELECT * FROM perdas LIMIT 2`,
      sql`SELECT * FROM vendas LIMIT 2`,
    ]);

    return Response.json({ vendasCols, perdasSample, vendasSample });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});