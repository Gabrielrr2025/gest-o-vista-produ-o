import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sql = neon(Deno.env.get('POSTGRES_CONNECTION_URL'));

    const [tables, setores, perdasCount, perdasCols, vendasSample] = await Promise.all([
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      sql`SELECT DISTINCT departamento_desc FROM produtos WHERE departamento_desc IS NOT NULL ORDER BY departamento_desc`,
      sql`SELECT COUNT(*) as total FROM information_schema.tables WHERE table_name = 'perdas'`,
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'perdas' ORDER BY ordinal_position`.catch(() => []),
      sql`SELECT COUNT(*) as total FROM perdas`.catch(() => [{ total: 'tabela nao existe' }]),
    ]);

    return Response.json({
      tables: tables.map(t => t.table_name),
      setores_no_banco: setores.map(s => s.departamento_desc),
      perdas_table_exists: perdasCount[0]?.total > 0,
      perdas_columns: perdasCols,
      perdas_total_rows: vendasSample[0]?.total,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});