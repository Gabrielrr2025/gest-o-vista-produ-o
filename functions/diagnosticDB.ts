import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    steps: [],
    success: false
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      diagnostics.steps.push({ step: 'auth', status: 'failed', error: 'Not authenticated' });
      return Response.json(diagnostics, { status: 401 });
    }

    diagnostics.steps.push({ step: 'auth', status: 'success', user: user.email });

    // Check environment variable
    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      diagnostics.steps.push({ 
        step: 'env_var', 
        status: 'failed', 
        error: 'POSTGRES_CONNECTION_URL not set' 
      });
      return Response.json(diagnostics, { status: 500 });
    }

    diagnostics.steps.push({ 
      step: 'env_var', 
      status: 'success',
      connection: connectionString.substring(0, 30) + '...' 
    });

    // Connect to database
    const sql = neon(connectionString);
    diagnostics.steps.push({ step: 'connection', status: 'success' });

    // Check if produtos table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'produtos'
      )
    `;
    
    diagnostics.steps.push({ 
      step: 'table_exists', 
      status: tableExists[0].exists ? 'success' : 'failed',
      exists: tableExists[0].exists
    });

    if (!tableExists[0].exists) {
      diagnostics.steps.push({ 
        step: 'error', 
        message: 'Table produtos does not exist. Please create it first.' 
      });
      return Response.json(diagnostics, { status: 500 });
    }

    // Get table structure
    const columns = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'produtos'
      ORDER BY ordinal_position
    `;

    diagnostics.steps.push({ 
      step: 'table_structure', 
      status: 'success',
      columns: columns.map(c => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable,
        default: c.column_default
      }))
    });

    // Count existing products
    const count = await sql`SELECT COUNT(*) as total FROM produtos`;
    diagnostics.steps.push({ 
      step: 'product_count', 
      status: 'success',
      count: count[0].total
    });

    // Try to insert a test product
    try {
      const testProduct = await sql`
        INSERT INTO produtos (
          nome, 
          codigo, 
          setor, 
          unidade, 
          rendimento, 
          dias_producao, 
          status
        ) VALUES (
          'TESTE_DIAGNOSTIC',
          'TEST001',
          'Teste',
          'UN',
          1,
          ${JSON.stringify(['Segunda', 'Terça'])},
          'ativo'
        )
        RETURNING id
      `;

      diagnostics.steps.push({ 
        step: 'test_insert', 
        status: 'success',
        product_id: testProduct[0].id
      });

      // Delete test product
      await sql`DELETE FROM produtos WHERE id = ${testProduct[0].id}`;
      diagnostics.steps.push({ step: 'test_cleanup', status: 'success' });

    } catch (insertError) {
      diagnostics.steps.push({ 
        step: 'test_insert', 
        status: 'failed',
        error: insertError.message,
        stack: insertError.stack
      });
    }

    diagnostics.success = true;
    return Response.json(diagnostics);

  } catch (error) {
    diagnostics.steps.push({ 
      step: 'general_error', 
      status: 'failed',
      error: error.message,
      stack: error.stack
    });
    
    return Response.json(diagnostics, { status: 500 });
  }
});
