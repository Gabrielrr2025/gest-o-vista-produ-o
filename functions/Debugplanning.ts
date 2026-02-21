import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connStr = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connStr) {
      return Response.json({ 
        erro: 'POSTGRES_CONNECTION_URL não encontrada',
        env_keys: Object.keys(Deno.env.toObject()).filter(k => !k.includes('SECRET'))
      });
    }

    const sql = neon(connStr);

    // Testar conexão simples
    const ping = await sql`SELECT 1 as ok`;
    
    // Ver tipo do campo dias_producao
    const colInfo = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'produtos' AND column_name = 'dias_producao'
    `;

    // Ver os primeiros 5 produtos com o valor RAW
    const produtos = await sql`
      SELECT id, nome, dias_producao,
             pg_typeof(dias_producao) as tipo_real
      FROM produtos
      LIMIT 5
    `;

    return Response.json({
      conexao: 'OK',
      coluna_dias_producao: colInfo[0] || 'COLUNA NAO ENCONTRADA',
      produtos_amostra: produtos.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        dias_producao_raw: p.dias_producao,
        tipo_postgres: p.tipo_real,
        tipo_js: typeof p.dias_producao,
        is_array: Array.isArray(p.dias_producao),
      }))
    });
  } catch (e: any) {
    return Response.json({ 
      erro: e.message,
      stack: e.stack?.split('\n').slice(0,5)
    }, { status: 500 });
  }
});
