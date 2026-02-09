import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { chave } = body;

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    // Se passou chave específica, busca só ela
    if (chave) {
      console.log(`⚙️ Buscando config: ${chave}`);
      
      const result = await sql`
        SELECT chave, valor, descricao, updated_at
        FROM configuracoes
        WHERE chave = ${chave}
        LIMIT 1
      `;

      if (result.length === 0) {
        return Response.json({ 
          error: `Configuração '${chave}' não encontrada` 
        }, { status: 404 });
      }

      return Response.json(result[0]);
    }

    // Senão, busca todas
    console.log('⚙️ Buscando todas as configurações');
    
    const result = await sql`
      SELECT chave, valor, descricao, updated_at
      FROM configuracoes
      ORDER BY chave
    `;

    return Response.json({
      configuracoes: result
    });

  } catch (error) {
    console.error('❌ Erro ao buscar configuração:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
