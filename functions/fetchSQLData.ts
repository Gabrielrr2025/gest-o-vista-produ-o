import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import postgres from 'npm:postgres@3.4.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { startDate, endDate } = await req.json();

        // Log temporário para validar host
        console.log('=== POSTGRES CONFIG ===');
        console.log('Host:', Deno.env.get('POSTGRES_HOST'));
        console.log('Port:', Deno.env.get('POSTGRES_PORT'));
        console.log('Database:', Deno.env.get('POSTGRES_DATABASE'));
        console.log('User:', Deno.env.get('POSTGRES_USER'));
        console.log('======================');

        // Conectar ao PostgreSQL usando connection string com SSL
        const connectionString = `postgres://${Deno.env.get('POSTGRES_USER')}:${Deno.env.get('POSTGRES_PASSWORD')}@${Deno.env.get('POSTGRES_HOST')}:${Deno.env.get('POSTGRES_PORT') || '5432'}/${Deno.env.get('POSTGRES_DATABASE')}?sslmode=require`;
        
        const sql = postgres(connectionString, {
            ssl: { rejectUnauthorized: false }
        });

        try {
            // Query na view vw_movimentacoes
            let query = sql`
                SELECT data, semana, mes, produto, setor, quantidade, valor, tipo
                FROM vw_movimentacoes
                WHERE 1=1
            `;

            if (startDate) {
                query = sql`
                    SELECT data, semana, mes, produto, setor, quantidade, valor, tipo
                    FROM vw_movimentacoes
                    WHERE data >= ${startDate}
                `;
            }

            if (startDate && endDate) {
                query = sql`
                    SELECT data, semana, mes, produto, setor, quantidade, valor, tipo
                    FROM vw_movimentacoes
                    WHERE data >= ${startDate} AND data <= ${endDate}
                `;
            }

            const results = await query;

            // Transformar para formato compatível com o sistema atual
            const salesData = [];
            const lossData = [];

            for (const row of results) {
                const record = {
                    product_name: row.produto,
                    sector: row.setor,
                    quantity: parseFloat(row.quantidade),
                    date: row.data,
                    week_number: parseInt(row.semana),
                    month: parseInt(row.mes),
                    year: new Date(row.data).getFullYear()
                };

                if (row.tipo.toLowerCase() === 'venda') {
                    salesData.push(record);
                } else if (row.tipo.toLowerCase() === 'perda') {
                    lossData.push(record);
                }
            }

            await sql.end();

            return Response.json({
                success: true,
                salesData,
                lossData,
                totalRecords: results.length
            });

        } catch (queryError) {
            await sql.end();
            throw queryError;
        }

    } catch (error) {
        console.error('=== ERRO SQL COMPLETO ===');
        console.error('Nome:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        console.error('Código:', error.code);
        console.error('Detalhes:', error.detail);
        console.error('Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error('========================');
        
        return Response.json({ 
            success: false,
            error: 'Erro ao buscar dados do banco de dados',
            errorMessage: error.message,
            errorName: error.name,
            errorCode: error.code,
            errorStack: error.stack,
            errorDetails: error.detail,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, { status: 200 });
    }
});