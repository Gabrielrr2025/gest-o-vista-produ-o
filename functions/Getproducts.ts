import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  const debug = { step: '', timestamp: new Date().toISOString(), error: null };

  try {
    debug.step = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', debug }, { status: 401 });

    debug.step = 'env_check';
    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada', debug }, { status: 500 });
    }

    debug.step = 'sql_connect';
    const sql = neon(connectionString);

    // Garantir que todas as colunas necessárias existem
    debug.step = 'ensure_columns';
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS horario_fabricacao VARCHAR(5)`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS horario_venda VARCHAR(5)`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tempo_preparo INTEGER`;

    debug.step = 'query_start';
    const products = await sql`
      SELECT
        id, nome, codigo, setor, unidade, rendimento,
        dias_producao, status, horario_fabricacao, horario_venda,
        tempo_preparo, created_at
      FROM produtos
      ORDER BY setor, nome
    `;

    debug.step = 'format_start';
    const formattedProducts = products.map((p) => {
      let diasProducao = [];
      try {
        if (p.dias_producao) {
          if (Array.isArray(p.dias_producao)) diasProducao = p.dias_producao;
          else if (typeof p.dias_producao === 'string') diasProducao = JSON.parse(p.dias_producao);
          else diasProducao = Object.values(p.dias_producao);
        }
      } catch { diasProducao = []; }

      return {
        id: p.id,
        name: p.nome,
        code: p.codigo,
        sector: p.setor,
        unit: p.unidade,
        recipe_yield: parseFloat(p.rendimento) || 1,
        production_days: diasProducao,
        active: p.status === 'ativo',
        manufacturing_time: p.horario_fabricacao || null,
        sale_time: p.horario_venda || null,
        production_time: p.tempo_preparo || null,
        created_at: p.created_at
      };
    });

    return Response.json({ success: true, products: formattedProducts, debug });

  } catch (error) {
    debug.error = { message: error.message, stack: error.stack, name: error.name };
    return Response.json({ success: false, error: error.message, debug }, { status: 500 });
  }
});
