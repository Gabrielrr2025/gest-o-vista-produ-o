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
    const { name, code, sector, unit, recipe_yield, production_days, active } = body;

    if (!name || !sector) {
      return Response.json({ 
        error: 'Campos obrigatórios: name, sector' 
      }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📦 Criando produto: ${name}`);

    // Verificar se já existe produto com mesmo nome
    const existing = await sql`
      SELECT id, nome FROM produtos WHERE LOWER(nome) = LOWER(${name})
    `;

    if (existing.length > 0) {
      return Response.json({ 
        error: `Produto "${name}" já existe` 
      }, { status: 409 });
    }

    // Verificar se código já existe (se fornecido)
    if (code && code.trim()) {
      const existingCode = await sql`
        SELECT id, codigo FROM produtos WHERE LOWER(codigo) = LOWER(${code.trim()})
      `;

      if (existingCode.length > 0) {
        return Response.json({ 
          error: `Código "${code}" já está em uso` 
        }, { status: 409 });
      }
    }

    // Criar produto
    const result = await sql`
      INSERT INTO produtos (
        nome, 
        codigo, 
        setor, 
        unidade, 
        rendimento, 
        dias_producao, 
        status
      ) VALUES (
        ${name},
        ${code || null},
        ${sector},
        ${unit || 'UN'},
        ${recipe_yield || 1},
        ${JSON.stringify(production_days || [])},
        ${active !== false ? 'ativo' : 'inativo'}
      )
      RETURNING *
    `;

    console.log('✅ Produto criado:', result[0]);

    // Formatar resposta
    const created = result[0];
    const formattedProduct = {
      id: created.id,
      name: created.nome,
      code: created.codigo,
      sector: created.setor,
      unit: created.unidade,
      recipe_yield: parseFloat(created.rendimento) || 1,
      production_days: created.dias_producao || [],
      active: created.status === 'ativo',
      created_at: created.created_at,
      updated_at: created.updated_at
    };

    return Response.json({
      success: true,
      product: formattedProduct
    });

  } catch (error) {
    console.error('❌ Erro ao criar produto:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});
