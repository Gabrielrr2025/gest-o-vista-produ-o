import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  const debug = {
    step: '',
    timestamp: new Date().toISOString(),
    error: null
  };

  try {
    debug.step = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized', debug }, { status: 401 });
    }
    console.log('✅ Auth OK:', user.email);

    debug.step = 'env_check';
    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');

    if (!connectionString) {
      debug.error = 'POSTGRES_CONNECTION_URL não configurada';
      return Response.json({ error: debug.error, debug }, { status: 500 });
    }
    console.log('✅ Connection string OK');

    debug.step = 'sql_connect';
    const sql = neon(connectionString);
    console.log('✅ SQL client criado');

    // Garantir que colunas necessárias existem
    debug.step = 'ensure_columns';
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS horario_fabricacao VARCHAR(5)`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS horario_venda VARCHAR(5)`;
    console.log('✅ Colunas verificadas');

    debug.step = 'query_start';
    console.log('📦 Executando query SELECT...');

    const products = await sql`
      SELECT
        id,
        nome,
        codigo,
        setor,
        unidade,
        rendimento,
        dias_producao,
        status,
        horario_fabricacao,
        horario_venda,
        created_at
      FROM produtos
      ORDER BY setor, nome
    `;

    debug.step = 'query_complete';
    console.log(`✅ Query executada: ${products.length} produtos`);

    debug.step = 'format_start';
    const formattedProducts = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      console.log(`📦 Formatando produto ${i + 1}/${products.length}: ${p.nome}`);

      try {
        let diasProducao = [];

        if (p.dias_producao) {
          if (Array.isArray(p.dias_producao)) {
            diasProducao = p.dias_producao;
          } else if (typeof p.dias_producao === 'string') {
            diasProducao = JSON.parse(p.dias_producao);
          } else if (typeof p.dias_producao === 'object') {
            diasProducao = p.dias_producao;
          }
        }

        formattedProducts.push({
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
          created_at: p.created_at
        });

      } catch (formatError) {
        console.error(`❌ Erro ao formatar produto ${p.nome}:`, formatError);
        debug.error = `Erro ao formatar produto ${p.nome}: ${formatError.message}`;
        throw formatError;
      }
    }

    debug.step = 'format_complete';
    console.log('✅ Formatação completa');

    debug.step = 'return_json';
    return Response.json({
      success: true,
      products: formattedProducts,
      debug
    });

  } catch (error) {
    console.error('❌ ERRO em getProducts');
    console.error('Step atual:', debug.step);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Name:', error.name);

    debug.error = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };

    return Response.json({
      success: false,
      error: error.message,
      debug
    }, { status: 500 });
  }
});
