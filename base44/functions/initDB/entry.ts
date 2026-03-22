import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    // Criar tabela planejamento
    await sql`
      CREATE TABLE IF NOT EXISTS planejamento (
        id SERIAL PRIMARY KEY,
        produto_id VARCHAR(100) NOT NULL,
        data DATE NOT NULL,
        quantidade_planejada NUMERIC DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(produto_id, data)
      )
    `;

    // Criar tabela configuracoes
    await sql`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id SERIAL PRIMARY KEY,
        chave VARCHAR(100) NOT NULL UNIQUE,
        valor TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Inserir configs padrão se não existirem
    await sql`
      INSERT INTO configuracoes (chave, valor) VALUES
        ('planejamento_semanas_historico', '8'),
        ('planejamento_postura', 'equilibrado'),
        ('planejamento_sugestao_sem_dados', '10'),
        ('codigo_edicao_planejamento', '1234')
      ON CONFLICT (chave) DO NOTHING
    `;

    return Response.json({
      success: true,
      message: 'Tabelas criadas com sucesso: planejamento, configuracoes',
    });

  } catch (error) {
    console.error('Erro ao inicializar DB:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});