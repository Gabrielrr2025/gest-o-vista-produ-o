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
    const { id } = body;

    if (!id) {
      return Response.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    // Verificar se produto existe
    const existing = await sql`
      SELECT id, nome, status FROM produtos WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    console.log(`🗑️ Desativando produto ID: ${id} (${existing[0].nome})`);

    // Soft delete: mudar status para 'inativo'
    // O produto sai da lista de cadastrados e do planejamento
    // Mas continua no banco com vendas e perdas vinculadas
    await sql`UPDATE produtos SET status = 'inativo', updated_at = NOW() WHERE id = ${id}`;

    // Remover planejamento futuro desse produto
    await sql`DELETE FROM planejamento WHERE produto_id = ${id}`;

    console.log(`✅ Produto desativado. Voltará ao card laranja como não cadastrado.`);

    return Response.json({
      success: true,
      deleted: true,
      message: 'Produto desativado. Vendas e perdas históricas mantidas.'
    });

  } catch (error) {
    console.error('❌ Erro ao desativar produto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
