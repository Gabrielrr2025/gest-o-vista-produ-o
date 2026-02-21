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
      SELECT id, nome FROM produtos WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    console.log(`🗑️ Deletando produto ID: ${id} (${existing[0].nome})`);

    // Apagar apenas o planejamento vinculado (não apaga vendas nem perdas)
    // Assim o produto volta a aparecer no card laranja como não mapeado
    await sql`DELETE FROM planejamento WHERE produto_id = ${id}`;
    await sql`DELETE FROM produtos WHERE id = ${id}`;

    console.log(`✅ Produto deletado. Vendas e perdas mantidas.`);

    return Response.json({
      success: true,
      deleted: true,
      message: 'Produto removido. Vendas e perdas históricas mantidas.'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar produto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
