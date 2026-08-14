// Nome do bucket, sozinho num módulo sem nenhum import — e isso é o ponto, não descuido.
//
// A constante morava em `uploadDeAssetBase.ts`, que importa o cliente Supabase do
// navegador. Importá-la de lá arrastava o singleton anon-key para dentro de
// `leituraDeAssetBase.ts` por via transitiva, e o singleton lê `import.meta.env` e dá
// throw no carregamento — o que tornava a leitura impossível de importar em Node puro,
// exatamente o que a função serverless da rodada 3 precisa fazer.
//
// Módulo folha, portanto: quem só precisa do nome do bucket não paga por um cliente.

export const BUCKET_DE_ASSETS = 'assets-base';
