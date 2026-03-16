import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sql = neon(Deno.env.get('POSTGRES_CONNECTION_URL'));

    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'produtos'
      ORDER BY ordinal_position
    `;

    const sample = await sql`SELECT * FROM produtos LIMIT 2`;

    return Response.json({ columns, sample });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});