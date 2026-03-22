import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sql = neon(Deno.env.get('POSTGRES_CONNECTION_URL'));

    const [columns, sample, rowCount] = await Promise.all([
      sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'vendas' 
        ORDER BY ordinal_position
      `,
      sql`SELECT * FROM vendas LIMIT 2`,
      sql`SELECT COUNT(*) as total FROM vendas`
    ]);

    return Response.json({ columns, sample, rowCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});