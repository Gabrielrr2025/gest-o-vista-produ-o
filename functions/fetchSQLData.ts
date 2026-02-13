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
        const sql = neon(DATABASE_URL);

        // ATUALIZADO: usar as novas colunas da view
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

        query += ` ORDER BY data DESC`;

        const results = await sql(query, params);

        const salesData = [];
        const lossData = [];

        for (const row of results) {
            const record = {
                product_name: row.produto,
                product_code: '', // VIEW pode não ter código
                sector: row.setor,
                quantity: parseFloat(row.quantidade),
                value: parseFloat(row.valor),
                date: row.data,
                week_number: row.numero_semana,
                year: row.ano,
                week_start: row.data_inicio,
                week_end: row.data_fim
            };

            if (row.tipo.toLowerCase() === 'venda') {
                salesData.push(record);
            } else if (row.tipo.toLowerCase() === 'perda') {
                lossData.push(record);
            }
        }

        return Response.json({
            success: true,
            sales: salesData, // Mudado de salesData para sales
            losses: lossData, // Mudado de lossData para losses
            totalRecords: results.length
        });

    } catch (error) {
        console.error('=== ERRO SQL ===', error);
        return Response.json({ 
            success: false,
            error: error.message
        }, { status: 500 });
    }
});
