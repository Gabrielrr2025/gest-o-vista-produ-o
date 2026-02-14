import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  let name, code, sector, unit, recipe_yield, production_days, active, manufacturing_time, sale_time; // Declarar fora do try
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    // Atribuir valores às variáveis já declaradas
    ({ name, code, sector, unit, recipe_yield, production_days, active, manufacturing_time, sale_time } = body);

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

    console.log(`📦 Criando produto: ${name} (${sector})`);

    // Verificar se já existe produto com mesmo nome E setor
    const existing = await sql`
      SELECT id, nome, setor FROM produtos 
      WHERE LOWER(nome) = LOWER(${name}) 
      AND LOWER(setor) = LOWER(${sector})
    `;

    if (existing.length > 0) {
      console.log(`⚠️ Produto "${name}" (${sector}) já existe com ID ${existing[0].id}`);
      return Response.json({ 
        error: `Produto "${name}" no setor "${sector}" já existe`,
        existingId: existing[0].id
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
        status,
        horario_fabricacao,
        horario_venda
      ) VALUES (
        ${name},
        ${code || null},
        ${sector},
        ${unit || 'UN'},
        ${recipe_yield || 1},
        ${JSON.stringify(production_days || [])},
        ${active !== false ? 'ativo' : 'inativo'},
        ${manufacturing_time || null},
        ${sale_time || null}
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
      manufacturing_time: created.horario_fabricacao || null,
      sale_time: created.horario_venda || null,
      created_at: created.created_at,
      updated_at: created.updated_at
    };

    return Response.json({
      success: true,
      product: formattedProduct
    });

  } catch (error) {
    console.error('❌ Erro ao criar produto:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Agora as variáveis estão acessíveis aqui
    if (name || code || sector) {
      console.error('Dados recebidos:', { name, code, sector, unit, recipe_yield, production_days, active, manufacturing_time, sale_time });
    }
    
    // Mensagem mais detalhada dependendo do tipo de erro
    let errorMessage = error.message;
    let statusCode = 500;
    
    // Erro de conexão com banco
    if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Erro de conexão com o banco de dados. Verifique POSTGRES_CONNECTION_URL.';
    }
    // Erro de tabela não existe
    else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      errorMessage = 'Tabela "produtos" não existe. Execute o script create_produtos_table.sql.';
    }
    // Erro de constraint/validação
    else if (error.message.includes('violates') || error.message.includes('constraint')) {
      errorMessage = `Violação de restrição do banco: ${error.message}`;
      statusCode = 400;
    }
    
    return Response.json({ 
      error: errorMessage,
      details: error.message,
      stack: error.stack
    }, { status: statusCode });
  }
});