import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Acesso negado. Apenas administradores podem alterar configurações.' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { chave, valor } = body;

    if (!chave || valor === undefined) {
      return Response.json({ 
        error: 'Missing required fields: chave, valor' 
      }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`💾 Salvando config: ${chave} = ${valor}`);

    // Upsert: atualizar ou inserir
    const result = await sql`
      INSERT INTO configuracoes (chave, valor, updated_at)
      VALUES (${chave}, ${valor}, NOW())
      ON CONFLICT (chave) 
      DO UPDATE SET 
        valor = ${valor},
        updated_at = NOW()
      RETURNING *
    `;

    console.log('✅ Configuração salva:', result[0]);

    return Response.json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error('❌ Erro ao salvar configuração:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
