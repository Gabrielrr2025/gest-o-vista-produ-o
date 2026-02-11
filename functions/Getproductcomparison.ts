import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    console.log('🚀 Function chamada!');
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.log('❌ Não autenticado');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Usuário autenticado:', user.email);

    const body = await req.json();
    console.log('📥 Body recebido:', JSON.stringify(body, null, 2));

    const { productIds, startDate, endDate, type = 'sales' } = body;

    // Validação básica
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      console.log('❌ productIds inválido');
      return Response.json({ error: 'productIds deve ser um array não vazio' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      console.log('❌ Datas inválidas');
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      console.log('❌ Sem connection string');
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    console.log('✅ Connection string OK');
    const sql = neon(connectionString);

    // Testar uma query SUPER simples primeiro
    console.log('🔍 Testando query simples...');
    const testQuery = await sql`SELECT NOW() as agora`;
    console.log('✅ Query teste OK:', testQuery);

    // Agora buscar produto
    const productId = parseInt(productIds[0]);
    console.log(`🔍 Buscando produto ${productId}...`);

    const productInfo = await sql`
      SELECT id, nome, setor, unidade
      FROM produtos
      WHERE id = ${productId}
    `;

    console.log('✅ Produto encontrado:', productInfo);

    if (productInfo.length === 0) {
      return Response.json({ 
        error: 'Produto não encontrado',
        productId 
      }, { status: 404 });
    }

    // Retornar dados mock por enquanto
    return Response.json({
      period: { start: startDate, end: endDate },
      type,
      products: [{
        produto: productInfo[0],
        evolution: [
          { data: startDate, valor: 100, quantidade: 10 },
          { data: endDate, valor: 200, quantidade: 20 }
        ],
        stats: {
          totalValor: 300,
          totalQuantidade: 30,
          mediaValor: 150,
          diasComDados: 2,
          pico: { valor: 200, data: endDate },
          vale: { valor: 100, data: startDate }
        }
      }]
    });

  } catch (error) {
    console.error('\n❌❌❌ ERRO CRÍTICO:');
    console.error('Type:', typeof error);
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    console.error('Stack:', error.stack);
    console.error('Error completo:', JSON.stringify(error, null, 2));
    
    return Response.json({ 
      error: error.message || 'Erro desconhecido',
      type: error.name || 'UnknownError',
      details: error.toString()
    }, { status: 500 });
  }
});
