import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    const sql = neon(connectionString);

    // Amostras de perdas na view
    const sample = await sql`SELECT * FROM vw_movimentacoes WHERE tipo = 'perda' LIMIT 3`;
    // Definição da view
    const viewDef = await sql`SELECT view_definition FROM information_schema.views WHERE table_name = 'vw_movimentacoes'`;
    return Response.json({ sample, viewDef });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});