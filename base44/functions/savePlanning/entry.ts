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
    const { produto_id, data, quantidade_planejada } = body;

    if (!produto_id || !data || quantidade_planejada === undefined) {
      return Response.json({ 
        error: 'Missing required fields: produto_id, data, quantidade_planejada' 
      }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`💾 Salvando planejamento: produto_id=${produto_id}, data=${data}, qtd=${quantidade_planejada}`);

    // Upsert: inserir ou atualizar se já existir
    const result = await sql`
      INSERT INTO planejamento (produto_id, data, quantidade_planejada, updated_at)
      VALUES (${produto_id}, ${data}, ${quantidade_planejada}, NOW())
      ON CONFLICT (produto_id, data) 
      DO UPDATE SET 
        quantidade_planejada = ${quantidade_planejada},
        updated_at = NOW()
      RETURNING *
    `;

    console.log('✅ Planejamento salvo:', result[0]);

    return Response.json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error('❌ Erro ao salvar planejamento:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
