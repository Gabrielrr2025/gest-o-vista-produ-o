import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { startDate, endDate } = await req.json();

        // Connection string do Neon
        const DATABASE_URL = `postgresql://${Deno.env.get('POSTGRES_USER')}:${Deno.env.get('POSTGRES_PASSWORD')}@${Deno.env.get('POSTGRES_HOST')}/${Deno.env.get('POSTGRES_DATABASE')}?sslmode=require`;
        
        const sql = neon(DATABASE_URL);

        // Query na view vw_movimentacoes
        let query = `
            SELECT data, semana, mes, produto, setor, quantidade, valor, tipo
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