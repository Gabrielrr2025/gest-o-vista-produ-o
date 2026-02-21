# Padronização de nomenclatura (pastas/funções)

## O que foi identificado
Havia inconsistência de ortografia e convenção de nomes nas funções serverless, por exemplo:
- `Createproduct`, `Updateproduct`, `Getproducts`
- `Getlossesreport`, `Getproductcomparison`, `Getproductevolution`
- mistura de `PascalCase`, `camelCase` e iniciais minúsculas

## O que foi aplicado
Foi iniciada uma padronização para **camelCase** nas funções e chamadas no front-end:
- `createProduct`
- `updateProduct`
- `deleteProduct`
- `getProducts`
- `getLossesReport`
- `getProductComparison`
- `getProductEvolutionDetailed`

Também foram criados arquivos com nomes padronizados em `functions/` para facilitar migração incremental, sem remover imediatamente os arquivos legados.

## Recomendação de próximo passo
1. Deprecar os arquivos antigos (`Createproduct.ts`, etc.) após validar em produção.
2. Padronizar também arquivos como `getReportData_MULTIPERIOD.ts` para `getReportDataMultiPeriod.ts`.
3. Definir regra no README: funções backend em `camelCase` e componentes React em `PascalCase`.
