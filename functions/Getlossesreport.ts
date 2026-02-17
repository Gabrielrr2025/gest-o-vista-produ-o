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
    const { 
      startDate, 
      endDate,
      topN = 10
    } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`💸 Relatório de Perdas: ${startDate} a ${endDate}`);

    // ========================================
    // DETECTAR ESTRUTURA DA TABELA
    // ========================================
    
    let tableStructure;
    try {
      tableStructure = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'perdas'
        ORDER BY ordinal_position
      `;
      console.log('📋 Estrutura da tabela perdas:', tableStructure);
    } catch (error) {
      console.error('❌ Erro ao verificar estrutura:', error.message);
    }

    // ========================================
    // TESTAR QUERY SIMPLES PRIMEIRO
    // ========================================
    
    let testQuery;
    try {
      console.log('🧪 Testando query simples...');
      testQuery = await sql`
        SELECT * FROM perdas LIMIT 1
      `;
      console.log('✅ Query teste OK. Exemplo de registro:', testQuery[0]);
    } catch (error) {
      console.error('❌ Erro na query teste:', error.message);
      return Response.json({ 
        error: 'Erro ao acessar tabela perdas',
        details: error.message
      }, { status: 500 });
    }

    // ========================================
    // DESCOBRIR NOMES DAS COLUNAS
    // ========================================
    
    const sampleRow = testQuery[0];
    const columns = sampleRow ? Object.keys(sampleRow) : [];
    console.log('📊 Colunas disponíveis:', columns);

    // Tentar descobrir qual coluna é qual
    const dataColumn = columns.find(c => c.includes('data')) || 'data';
    const valorColumn = columns.find(c => c.includes('valor')) || 'valor_reais';
    const quantidadeColumn = columns.find(c => c.includes('quantidade')) || 'quantidade';
    const produtoIdColumn = columns.find(c => c.includes('produto')) || 'produto_id';

    console.log('🔍 Mapeamento de colunas:', {
      data: dataColumn,
      valor: valorColumn,
      quantidade: quantidadeColumn,
      produto_id: produtoIdColumn
    });

    // ========================================
    // CONTAR REGISTROS NO PERÍODO
    // ========================================
    
    let countResult;
    try {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM perdas
        WHERE ${sql(dataColumn)} BETWEEN ${startDate} AND ${endDate}
      `;
      console.log(`📊 Registros no período: ${countResult[0].total}`);
    } catch (error) {
      console.error('❌ Erro ao contar registros:', error.message);
    }

    // ========================================
    // QUERIES PRINCIPAIS (usando colunas detectadas)
    // ========================================

    // 1. Total geral simples (SEM JOIN)
    const totalGeral = await sql`
      SELECT 
        SUM(${sql(valorColumn)}) as total_valor,
        SUM(${sql(quantidadeColumn)}) as total_quantidade
      FROM perdas
      WHERE ${sql(dataColumn)} BETWEEN ${startDate} AND ${endDate}
    `;

    console.log('💰 Total geral:', totalGeral[0]);

    // 2. Dados brutos por data
    const rawLossesData = await sql`
      SELECT 
        ${sql(dataColumn)} as data,
        SUM(${sql(valorColumn)}) as valor_reais,
        SUM(${sql(quantidadeColumn)}) as quantidade
      FROM perdas
      WHERE ${sql(dataColumn)} BETWEEN ${startDate} AND ${endDate}
      GROUP BY ${sql(dataColumn)}
      ORDER BY ${sql(dataColumn)}
    `;

    console.log(`📈 Dados brutos: ${rawLossesData.length} dias com perdas`);

    // 3. Perdas por setor (COM LEFT JOIN)
    const lossesBySector = await sql`
      SELECT 
        COALESCE(p.setor, 'Sem Setor') as setor,
        SUM(pe.${sql(valorColumn)}) as total_valor,
        SUM(pe.${sql(quantidadeColumn)}) as total_quantidade
      FROM perdas pe
      LEFT JOIN produtos p ON pe.${sql(produtoIdColumn)} = p.id
      WHERE pe.${sql(dataColumn)} BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor
      ORDER BY total_valor DESC
    `;

    // 4. Perdas por produto (TOP N)
    const lossesByProduct = await sql`
      SELECT 
        p.id as produto_id,
        COALESCE(p.nome, 'Produto #' || pe.${sql(produtoIdColumn)}::text) as produto_nome,
        COALESCE(p.setor, 'Sem Setor') as setor,
        COALESCE(p.unidade, 'un') as unidade,
        SUM(pe.${sql(valorColumn)}) as total_valor,
        SUM(pe.${sql(quantidadeColumn)}) as total_quantidade
      FROM perdas pe
      LEFT JOIN produtos p ON pe.${sql(produtoIdColumn)} = p.id
      WHERE pe.${sql(dataColumn)} BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.id, p.nome, p.setor, p.unidade, pe.${sql(produtoIdColumn)}
      ORDER BY total_valor DESC
      LIMIT ${topN}
    `;

    // 5. Perdas por setor E produto
    const lossesBySectorProduct = await sql`
      SELECT 
        COALESCE(p.setor, 'Sem Setor') as setor,
        p.id as produto_id,
        COALESCE(p.nome, 'Produto #' || pe.${sql(produtoIdColumn)}::text) as produto_nome,
        COALESCE(p.unidade, 'un') as unidade,
        SUM(pe.${sql(valorColumn)}) as total_valor,
        SUM(pe.${sql(quantidadeColumn)}) as total_quantidade
      FROM perdas pe
      LEFT JOIN produtos p ON pe.${sql(produtoIdColumn)} = p.id
      WHERE pe.${sql(dataColumn)} BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor, p.id, p.nome, p.unidade, pe.${sql(produtoIdColumn)}
      ORDER BY p.setor, total_valor DESC
    `;

    const totalValue = totalGeral[0]?.total_valor ? parseFloat(totalGeral[0].total_valor) : 0;

    console.log(`✅ Processado: ${lossesBySector.length} setores, ${lossesByProduct.length} produtos, Total: R$ ${totalValue.toFixed(2)}`);

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
      data: {
        lossesBySector: lossesBySector.map(s => ({
          setor: s.setor,
          total_valor: parseFloat(s.total_valor || 0),
          total_quantidade: parseFloat(s.total_quantidade || 0)
        })),
        lossesByProduct: lossesByProduct.map(p => ({
          produto_id: p.produto_id,
          produto_nome: p.produto_nome,
          setor: p.setor,
          unidade: p.unidade,
          total_valor: parseFloat(p.total_valor || 0),
          total_quantidade: parseFloat(p.total_quantidade || 0)
        })),
        lossesBySectorProduct: lossesBySectorProduct.map(p => ({
          setor: p.setor,
          produto_id: p.produto_id,
          produto_nome: p.produto_nome,
          unidade: p.unidade,
          total_valor: parseFloat(p.total_valor || 0),
          total_quantidade: parseFloat(p.total_quantidade || 0)
        })),
        rawData: rawLossesData.map(r => ({
          data: r.data,
          valor_reais: parseFloat(r.valor_reais || 0),
          quantidade: parseFloat(r.quantidade || 0)
        })),
        totalGeral: totalValue
      },
      compareData: null,
      debug: {
        columnMapping: {
          data: dataColumn,
          valor: valorColumn,
          quantidade: quantidadeColumn,
          produto_id: produtoIdColumn
        },
        recordsInPeriod: countResult?.[0]?.total || 0,
        tableColumns: columns
      }
    });

  } catch (error) {
    console.error('❌ ERRO GERAL:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      details: error.stack,
      hint: 'Verifique os logs do console para mais detalhes sobre a estrutura da tabela'
    }, { status: 500 });
  }
});
