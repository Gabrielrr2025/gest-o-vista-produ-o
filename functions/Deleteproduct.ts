import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    console.log(`🗑️ Excluindo produto ID: ${id} da entidade Base44`);

    await base44.asServiceRole.entities.Product.delete(id);

    console.log(`✅ Produto excluído com sucesso.`);

    return Response.json({
      success: true,
      deleted: true,
      message: 'Produto excluído com sucesso.'
    });

  } catch (error) {
    console.error('❌ Erro ao excluir produto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});