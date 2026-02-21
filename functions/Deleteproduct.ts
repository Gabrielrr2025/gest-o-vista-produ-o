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
    const { id, soft = true } = body; // soft = true (desativa), soft = false (deleta permanente)

    if (!id) {
      return Response.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`🗑️ ${soft ? 'Desativando' : 'Deletando'} produto ID: ${id}`);

    // Verificar se produto existe
    const existing = await sql`
      SELECT id, nome FROM produtos WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return Response.json({ 
        error: 'Produto não encontrado' 
      }, { status: 404 });
    }

    if (soft) {
      // Verificar se há dependências antes de decidir
      const hasVendas = await sql`
        SELECT COUNT(*) as count FROM vendas WHERE produto_id = ${id}
      `;

      const hasPerdas = await sql`
        SELECT COUNT(*) as count FROM perdas WHERE produto_id = ${id}
      `;

      const hasPlanejamento = await sql`
        SELECT COUNT(*) as count FROM planejamento WHERE produto_id = ${id}
      `;

      const totalDependencies = 
        parseInt(hasVendas[0].count) + 
        parseInt(hasPerdas[0].count) + 
        parseInt(hasPlanejamento[0].count);

      if (totalDependencies > 0) {
        // Se tem dependências, apenas desativa
        const result = await sql`
          UPDATE produtos 
          SET status = 'inativo', updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;

        console.log(`✅ Produto desativado (tem dependências): ${existing[0].nome}`);

        return Response.json({
          success: true,
          message: `Produto desativado (${totalDependencies} registros vinculados)`,
          product: {
            id: result[0].id,
            name: result[0].nome,
            active: false
          }
        });
      } else {
        // Se não tem dependências, deleta permanentemente
        await sql`
          DELETE FROM produtos WHERE id = ${id}
        `;

        console.log(`✅ Produto deletado (sem dependências): ${existing[0].nome}`);

        return Response.json({
          success: true,
          message: 'Produto removido com sucesso',
          deleted: true
        });
      }
    } else {
      // Hard delete: deletar permanentemente mesmo com dependências
      // Primeiro remove registros vinculados, depois o produto
      await sql`DELETE FROM planejamento WHERE produto_id = ${id}`;
      try { await sql`DELETE FROM perdas WHERE produto_id = ${id}`; } catch { /* tabela pode ser view somente-leitura */ }
      try { await sql`DELETE FROM vendas WHERE produto_id = ${id}`; } catch { /* tabela pode ser view somente-leitura */ }
      await sql`DELETE FROM produtos WHERE id = ${id}`;

      return Response.json({
        success: true,
        deleted: true,
        message: 'Produto deletado permanentemente'
      });
    }

  } catch (error) {
    console.error('❌ Erro ao deletar produto:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
