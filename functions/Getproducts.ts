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

    // Buscar todos os produtos
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
    const formattedProducts = products.map(p => {
      // Parsear dias_producao de forma segura
      let diasProducao = [];
      try {
        if (p.dias_producao) {
          // Se já é um array, usa direto
          if (Array.isArray(p.dias_producao)) {
            diasProducao = p.dias_producao;
          }
          // Se é string JSON, faz parse
          else if (typeof p.dias_producao === 'string') {
            diasProducao = JSON.parse(p.dias_producao);
          }
          // Se é objeto, tenta converter
          else if (typeof p.dias_producao === 'object') {
            diasProducao = p.dias_producao;
          }
        }
      } catch (parseError) {
        console.warn(`⚠️ Erro ao parsear dias_producao do produto ${p.nome}:`, parseError);
        diasProducao = [];
      }

      return {
        id: p.id,
        name: p.nome,
        code: p.codigo,
        sector: p.setor,
        unit: p.unidade,
        recipe_yield: parseFloat(p.rendimento) || 1,
        production_days: diasProducao,
        active: p.status === 'ativo',
        created_at: p.created_at
      };
    });

    console.log('📊 Produtos formatados:', formattedProducts.length);

    return Response.json({
      products: formattedProducts
    });

  } catch (error) {
    console.error('=== ERRO getProducts ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('========================');
    
    return Response.json({ 
      error: error.message,
      details: error.stack,
      errorName: error.name
    }, { status: 500 });
  }
});
