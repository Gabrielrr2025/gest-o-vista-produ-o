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

        // Tentar buscar da VIEW
        let query = `
            SELECT 
                data, 
                numero_semana,
                ano,
                data_inicio,
                data_fim,
                produto, 
                setor, 
                quantidade, 
                valor, 
                tipo
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

        query += ` ORDER BY data DESC LIMIT 10000`; // Limite de segurança

        console.log('📊 Executando query fetchSQLData...');
        console.log('📊 Params:', params);

        const results = await sql(query, params);
        
        console.log(`✅ Query executada! ${results.length} registros`);

        const salesData = [];
        const lossData = [];

        for (const row of results) {
            const record = {
                product_name: row.produto,
                product_code: '',
                sector: row.setor,
                quantity: parseFloat(row.quantidade) || 0,
                value: parseFloat(row.valor) || 0,
                date: row.data,
                week_number: row.numero_semana,
                year: row.ano,
                week_start: row.data_inicio,
                week_end: row.data_fim
            };

            const tipo = (row.tipo || '').toLowerCase();
            if (tipo === 'venda') {
                salesData.push(record);
            } else if (tipo === 'perda') {
                lossData.push(record);
            }
        }

        console.log(`📊 Processado: ${salesData.length} vendas, ${lossData.length} perdas`);

        return Response.json({
            success: true,
            sales: salesData,
            losses: lossData,
            totalRecords: results.length
        });

    } catch (error) {
        console.error('=== ERRO SQL fetchSQLData ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('================================');
        
        // Retornar arrays vazios em vez de erro para não quebrar o frontend
        return Response.json({ 
            success: false,
            sales: [],
            losses: [],
            error: error.message,
            details: error.stack
        });
    }
});
