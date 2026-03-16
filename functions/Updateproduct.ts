import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, code, sector, unit, recipe_yield, production_days, active, manufacturing_time, sale_time, production_time, price, cost } = body;

    if (!id) {
      return Response.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    console.log(`📦 Atualizando produto ID: ${id}`);

    const updateData = {};
    if (name !== undefined)               updateData.name = name;
    if (code !== undefined)               updateData.code = code || null;
    if (sector !== undefined)             updateData.sector = sector;
    if (unit !== undefined)               updateData.unit = unit;
    if (recipe_yield !== undefined)       updateData.recipe_yield = recipe_yield;
    if (production_days !== undefined)    updateData.production_days = production_days;
    if (active !== undefined)             updateData.active = active;
    if (manufacturing_time !== undefined) updateData.manufacturing_time = manufacturing_time || null;
    if (sale_time !== undefined)          updateData.sale_time = sale_time || null;
    if (production_time !== undefined)    updateData.production_time = production_time ? parseInt(production_time) : null;
    if (price !== undefined && price !== null) updateData.price = parseFloat(price);
    if (cost !== undefined && cost !== null)   updateData.cost = parseFloat(cost);

    const updated = await base44.asServiceRole.entities.Product.update(id, updateData);

    console.log('✅ Produto atualizado:', updated.id);
    return Response.json({ success: true, product: updated });

  } catch (error) {
    console.error('❌ Erro ao atualizar produto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});