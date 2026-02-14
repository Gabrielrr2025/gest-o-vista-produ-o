import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
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
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log('📦 Listando produtos do Neon...');

    // Buscar todos os produtos - sintaxe template string do neon
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
        created_at
      FROM produtos
      ORDER BY setor, nome
    `;

    console.log(`✅ ${products.length} produtos encontrados`);

    // Transformar para o formato esperado pelo frontend
    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.nome,
      code: p.codigo,
      sector: p.setor,
      unit: p.unidade,
      recipe_yield: parseFloat(p.rendimento) || 1,
      production_days: p.dias_producao || [],
      active: p.status === 'ativo',
      created_at: p.created_at
    }));

    return Response.json({
      products: formattedProducts
    });

  } catch (error) {
    console.error('=== ERRO getProducts ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================');
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});
