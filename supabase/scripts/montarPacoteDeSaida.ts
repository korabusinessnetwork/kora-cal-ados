// O que vai dentro do pacote de saída de um tenant, e como ele fica organizado.
//
// É função PURA: recebe linhas já lidas do banco e devolve a lista de arquivos. O script
// `exportarTenant.ts` é a casca que fala com o Supabase e escreve no disco. A separação existe
// porque o ADR-009 anota, na seção Consequências, que este é código que roda uma vez por cliente
// cancelado, e código que roda raramente apodrece sem ninguém notar. Com a decisão do CONTEÚDO
// aqui, ela tem teste que roda todo dia, sem banco.
//
// Fonte da política: `docs/08_DECISOES/adr-009-saida-do-cliente.md`. Este arquivo implementa D1
// (tudo que é da marca sai, em formato aberto), D2 (o acervo base não sai, e isso é dito de
// frente) e D3 (variante sai como receita, não como imagem).

import type { ArquivoDoZip } from './zip';

/** Os campos do tenant que saem. Lista explícita, nunca `select *` (CLAUDE.md). */
export interface TenantParaSaida {
  id: string;
  nome: string;
  slug: string;
  tema: unknown;
  plano: string | null;
  created_at: string;
}

export interface ZonaParaSaida {
  zone_key: string;
  label: string | null;
  svg_selector: string;
  cor_default: string | null;
  created_at: string;
}

export interface VarianteParaSaida {
  id: string;
  zone_colors: Record<string, string>;
  created_at: string;
}

export interface ProdutoParaSaida {
  id: string;
  nome: string;
  created_at: string;
  /** O asset-base canônico, já baixado do Storage. `null` quando o produto não tem um. */
  assetBase: { nomeDoArquivo: string; conteudo: Buffer } | null;
  zonas: ZonaParaSaida[];
  variantes: VarianteParaSaida[];
}

export interface SaidaDoTenant {
  tenant: TenantParaSaida;
  produtos: ProdutoParaSaida[];
}

/**
 * O nome da pasta de um produto dentro do pacote.
 *
 * Leva o nome legível E os 8 primeiros caracteres do id. O nome sozinho não serve porque dois
 * produtos do mesmo tenant podem se chamar igual, e duas pastas com o mesmo nome no ZIP fazem um
 * sobrescrever o outro na hora de extrair: o cliente perderia um produto inteiro sem nenhum aviso.
 * O id sozinho também não serve, porque um pacote de pastas UUID é ilegível para quem abre.
 */
export function pastaDoProduto({ id, nome }: { id: string; nome: string }): string {
  const legivel = nome
    .normalize('NFD')
    // Tira acento: a pasta precisa sobreviver a qualquer sistema de arquivos, inclusive os que
    // normalizam Unicode de forma diferente da nossa. O nome com acento continua no `produto.json`.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `produtos/${legivel === '' ? 'produto' : legivel}-${id.slice(0, 8)}`;
}

/** A saída de um tenant vira a lista de arquivos do pacote. */
export function montarPacoteDeSaida({ tenant, produtos }: SaidaDoTenant): ArquivoDoZip[] {
  const arquivos: ArquivoDoZip[] = [
    { nome: 'LEIA-ME.md', conteudo: leiaMe(tenant, produtos) },
    {
      nome: 'tenant.json',
      conteudo: comoJson({
        id: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug,
        tema: tenant.tema,
        plano: tenant.plano,
        created_at: tenant.created_at,
      }),
    },
  ];

  for (const produto of produtos) {
    const pasta = pastaDoProduto(produto);

    arquivos.push({
      nome: `${pasta}/produto.json`,
      conteudo: comoJson({ id: produto.id, nome: produto.nome, created_at: produto.created_at }),
    });

    // Zonas e variantes saem SEMPRE, inclusive vazias. Um arquivo `[]` responde "não havia
    // nenhuma"; um arquivo ausente deixa a pessoa se perguntando se a exportação falhou no meio.
    arquivos.push({
      nome: `${pasta}/zonas.json`,
      conteudo: comoJson(
        produto.zonas.map(({ zone_key, label, svg_selector, cor_default, created_at }) => ({
          zone_key,
          label,
          svg_selector,
          cor_default,
          created_at,
        })),
      ),
    });

    arquivos.push({
      nome: `${pasta}/variantes.json`,
      conteudo: comoJson(
        produto.variantes.map(({ id, zone_colors, created_at }) => ({
          id,
          zone_colors,
          created_at,
        })),
      ),
    });

    if (produto.assetBase !== null) {
      arquivos.push({
        nome: `${pasta}/${produto.assetBase.nomeDoArquivo}`,
        conteudo: produto.assetBase.conteudo,
      });
    }
  }

  return arquivos;
}

/** Dois espaços e uma quebra de linha no fim: é JSON para ser lido por gente, não só por máquina. */
function comoJson(valor: unknown): string {
  return `${JSON.stringify(valor, null, 2)}\n`;
}

/**
 * O documento que explica o pacote, e que diz o que NÃO está nele.
 *
 * A parte do "não está" é a razão de este arquivo existir, e vem direto do ADR-009 D2: uma saída
 * que entrega uma receita e guarda os ingredientes, sem avisar, é promessa falsa que o cliente
 * descobre no pior momento. Dizer de frente, aqui dentro do próprio pacote, é o que transforma o
 * limite em cláusula conhecida em vez de surpresa.
 */
function leiaMe(tenant: TenantParaSaida, produtos: ProdutoParaSaida[]): string {
  const zonas = produtos.reduce((soma, produto) => soma + produto.zonas.length, 0);
  const variantes = produtos.reduce((soma, produto) => soma + produto.variantes.length, 0);

  return `# Saída de ${tenant.nome}

Este pacote é a exportação completa dos dados da marca **${tenant.nome}** (\`${tenant.slug}\`),
em formatos abertos. Nada aqui exige a Kora para ser lido: SVG, glTF e JSON abrem em qualquer
lugar.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| \`tenant.json\` | Identidade e tema da marca |
| \`produtos/<produto>/produto.json\` | Nome e data do produto |
| \`produtos/<produto>/zonas.json\` | As zonas marcadas pelo seu time: chave, rótulo e seletor |
| \`produtos/<produto>/variantes.json\` | O histórico de variantes, como receita de cor por zona |
| \`produtos/<produto>/base.svg\` | O seu asset-base canônico, o arquivo que vocês subiram, normalizado |

Neste pacote: ${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}, ${zonas} ${zonas === 1 ? 'zona' : 'zonas'} e ${variantes} ${variantes === 1 ? 'variante' : 'variantes'}.

## O que NÃO tem aqui, e por quê

**As variantes não vêm renderizadas.** Elas saem como receita, a cor de cada zona, e não como
pasta de PNG ou SVG prontos. Gerar é barato e determinístico; guardar imagem é caro e envelhece.
Se você quer os arquivos prontos, **gere-os pela API antes de encerrar o contrato**, enquanto a
sua chave ainda está ativa. Depois do encerramento a chave deixa de responder, e este é o único
passo da saída que tem hora certa para acontecer.

**As peças do acervo base da Kora não vêm.** Se você usou o modo de calçado gerado, as
composições exportadas referenciam ids de peça de um acervo que a Kora modelou ou licenciou.
Essas peças continuam sendo da Kora, e sem elas a composição não monta fora daqui. Dizemos isto
de frente porque é um limite real: **o produto que você trouxe não tem essa dependência** (o
arquivo é seu, e você o leva inteiro), mas o calçado gerado tem, e esse foi o preço de não ter
precisado modelar nada.

**Dados de pessoas não vêm.** E-mails e identificadores dos usuários da sua conta ficam fora do
pacote por proteção de dados pessoais. Eles não fazem parte do que o contrato define como acervo
da marca, e um zip circulando por e-mail não é lugar para eles.

## Depois de conferir

Exportar e excluir são duas operações separadas, de propósito. Confira este pacote, abra os
arquivos, veja se está tudo aqui. Só então peça a exclusão dos dados. Assim não existe o caso em
que o pacote saiu incompleto e o original já não existe.
`;
}
