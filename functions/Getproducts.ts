import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar todos os produtos ativos da entidade Base44
    const products = await base44.asServiceRole.entities.Product.filter({ active: true }, 'name', 500);

    return Response.json({ success: true, products });

  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});