import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, code, sector, unit, recipe_yield, production_days, active, price } = body;

    if (!name || !sector) {
      return Response.json({ error: 'Campos obrigatórios: name, sector' }, { status: 400 });
    }

    console.log(`📦 Criando produto na entidade Base44: ${name} (${sector})`);

    // Verificar se já existe produto com mesmo nome e setor na entidade Base44
    const existing = await base44.asServiceRole.entities.Product.filter({ name, sector });

    if (existing && existing.length > 0) {
      // Se inativo, reativar
      if (!existing[0].active) {
        const reactivated = await base44.asServiceRole.entities.Product.update(existing[0].id, { active: true });
        return Response.json({ success: true, reactivated: true, product: reactivated });
      }
      return Response.json({
        error: `Produto "${name}" no setor "${sector}" já existe`,
        existingId: existing[0].id
      }, { status: 409 });
    }

    // Criar produto na entidade Base44
    const product = await base44.asServiceRole.entities.Product.create({
      name,
      code: code ? String(code) : undefined,
      sector,
      unit: unit || 'unidade',
      recipe_yield: recipe_yield || 1,
      production_days: production_days || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
      active: active !== false,
      price: price != null ? parseFloat(price) : 0,
      cost: body.cost != null ? parseFloat(body.cost) : 0,
    });

    console.log('✅ Produto criado:', product.id, product.name);

    return Response.json({ success: true, product });

  } catch (error) {
    console.error('❌ Erro ao criar produto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});