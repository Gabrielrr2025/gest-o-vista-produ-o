import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { codigo, custo, preco_venda } = body;

    if (!codigo) return Response.json({ error: 'codigo é obrigatório' }, { status: 400 });

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });

    const sql = neon(connectionString);

    // Garantir colunas existam
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC(10,4) DEFAULT NULL`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(10,4) DEFAULT NULL`;

    const result = await sql`
      UPDATE produtos 
      SET 
        custo = ${custo != null ? parseFloat(custo) : null},
        preco_venda = ${preco_venda != null ? parseFloat(preco_venda) : null}
      WHERE codigo = ${codigo}
      RETURNING codigo, descricao, custo, preco_venda
    `;

    if (result.length === 0) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    return Response.json({ success: true, product: result[0] });

  } catch (error) {
    console.error('❌ Erro updateProductPricing:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});