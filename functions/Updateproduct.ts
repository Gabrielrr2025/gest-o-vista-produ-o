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
    const { id, name, code, sector, unit, recipe_yield, production_days, active, manufacturing_time, sale_time, production_time } = body;

    if (!id) {
      return Response.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    // Garantir que a coluna tempo_preparo existe
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tempo_preparo INTEGER`;

    console.log(`📦 Atualizando produto ID: ${id}`);

    const existing = await sql`SELECT * FROM produtos WHERE id = ${id}`;
    if (existing.length === 0) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    if (name) {
      const duplicateName = await sql`
        SELECT id FROM produtos WHERE LOWER(nome) = LOWER(${name}) AND id != ${id}
      `;
      if (duplicateName.length > 0) {
        return Response.json({ error: `Produto "${name}" já existe` }, { status: 409 });
      }
    }

    if (code && code.trim()) {
      const duplicateCode = await sql`
        SELECT id FROM produtos WHERE LOWER(codigo) = LOWER(${code.trim()}) AND id != ${id}
      `;
      if (duplicateCode.length > 0) {
        return Response.json({ error: `Código "${code}" já está em uso` }, { status: 409 });
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined)             { updates.push(`nome = $${paramIndex++}`);              values.push(name); }
    if (code !== undefined)             { updates.push(`codigo = $${paramIndex++}`);             values.push(code || null); }
    if (sector !== undefined)           { updates.push(`setor = $${paramIndex++}`);              values.push(sector); }
    if (unit !== undefined)             { updates.push(`unidade = $${paramIndex++}`);            values.push(unit); }
    if (recipe_yield !== undefined)     { updates.push(`rendimento = $${paramIndex++}`);         values.push(recipe_yield); }
    if (production_days !== undefined)  { updates.push(`dias_producao = $${paramIndex++}`);      values.push(JSON.stringify(production_days)); }
    if (active !== undefined)           { updates.push(`status = $${paramIndex++}`);             values.push(active ? 'ativo' : 'inativo'); }
    if (manufacturing_time !== undefined) { updates.push(`horario_fabricacao = $${paramIndex++}`); values.push(manufacturing_time || null); }
    if (sale_time !== undefined)        { updates.push(`horario_venda = $${paramIndex++}`);      values.push(sale_time || null); }
    if (production_time !== undefined)  { updates.push(`tempo_preparo = $${paramIndex++}`);      values.push(production_time ? parseInt(production_time) : null); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE produtos SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql(query, values);
    const updated = result[0];

    const formattedProduct = {
      id: updated.id,
      name: updated.nome,
      code: updated.codigo,
      sector: updated.setor,
      unit: updated.unidade,
      recipe_yield: parseFloat(updated.rendimento) || 1,
      production_days: updated.dias_producao || [],
      active: updated.status === 'ativo',
      manufacturing_time: updated.horario_fabricacao || null,
      sale_time: updated.horario_venda || null,
      production_time: updated.tempo_preparo || null,
    };

    return Response.json({ success: true, product: formattedProduct });

  } catch (error) {
    console.error('❌ Erro ao atualizar produto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
