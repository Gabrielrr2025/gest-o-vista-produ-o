import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { startDate, endDate } = body;

        const DATABASE_URL = Deno.env.get('POSTGRES_CONNECTION_URL');
        
        if (!DATABASE_URL) {
            console.error('❌ POSTGRES_CONNECTION_URL não configurada');
            return Response.json({ 
                success: false,
                sales: [],
                losses: [],
                error: 'Database URL não configurada'
            });
        }
        
        const sql = neon(DATABASE_URL);

        console.log('📊 Buscando dados da VIEW vw_movimentacoes...');

        // Buscar da VIEW (pronto para integração futura!)
        let query = `
            SELECT 
                data,
                produto,
                produto_codigo,
                setor,
                quantidade,
                valor,
                tipo,
                numero_semana,
                ano
            FROM vw_movimentacoes
            WHERE 1=1
        `;
        const params = [];

        if (startDate && endDate) {
            query += ` AND data >= $1 AND data <= $2`;
            params.push(startDate, endDate);
        } else if (startDate) {
            query += ` AND data >= $1`;
            params.push(startDate);
        }

        query += ` ORDER BY data DESC LIMIT 10000`;

        console.log('🔍 Executando query na VIEW...');

        const results = await sql(query, params);
        
        console.log(`✅ Query executada! ${results.length} registros da VIEW`);

        const salesData = [];
        const lossData = [];

        for (const row of results) {
            const record = {
                product_name: row.produto,
                product_code: row.produto_codigo || '',
                sector: row.setor,
                quantity: parseFloat(row.quantidade) || 0,
                value: parseFloat(row.valor) || 0,
                date: row.data,
                week_number: row.numero_semana,
                year: row.ano
            };

            const tipo = (row.tipo || '').toLowerCase();
            if (tipo === 'venda') {
                salesData.push(record);
            } else if (tipo === 'perda') {
                lossData.push(record);
            }
        }

        console.log(`📊 Processado da VIEW: ${salesData.length} vendas, ${lossData.length} perdas`);

        return Response.json({
            success: true,
            sales: salesData,
            losses: lossData,
            totalRecords: results.length
        });

    } catch (error) {
        console.error('=== ERRO fetchSQLData (VIEW) ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('=================================');
        
        return Response.json({ 
            success: false,
            sales: [],
            losses: [],
            error: error.message,
            details: error.stack
        });
    }
});
