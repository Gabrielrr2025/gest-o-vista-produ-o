import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    const sql = neon(connectionString);

    const body = await req.json().catch(() => ({}));
    const table = body.table || 'vendas';

    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${table} ORDER BY ordinal_position`;
    const sample = await sql`SELECT * FROM vendas LIMIT 1`;

    return Response.json({ cols, sample });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});