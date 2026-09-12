// Exporta tudo que é da marca num zip, em formato aberto (ADR-009).
//
// Por que este arquivo vive em `supabase/` e NUNCA em `src/`: ele usa a `service_role`, que lê
// qualquer tenant. Nada que leia a service_role pode chegar ao bundle do navegador.
//
// Por que script e não tela: exportação é operação rara e de dono, e o ADR-009 D4 põe ela no mesmo
// balcão de `provisionarTenant` e `criarChaveDeApi`. Construir UI para algo que acontece uma vez
// por cliente cancelado é investir no lugar errado. Quando houver self-serve, vira botão.
//
// **Este script NÃO apaga nada.** Exportar e excluir são operações separadas (ADR-009 D5), para
// não existir o caso em que o pacote saiu incompleto e o original já não existe. A exclusão é
// outro script, e ele ainda não existe justamente porque a ordem certa é esta.

import { writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { lerSaidaDoTenant, TenantNaoEncontrado } from './lerSaidaDoTenant';
import { montarPacoteDeSaida } from './montarPacoteDeSaida';
import { montarZip } from './zip';

const AJUDA = `
Uso:
  node --env-file=.env.local supabase/scripts/executar.mjs \\
    supabase/scripts/exportarTenant.ts --slug aurora [--saida caminho/do/pacote.zip]

Produz o pacote de saída do ADR-009: identidade da marca, produtos, zonas marcadas,
histórico de variantes como receita, e o asset-base canônico de cada produto.

O pacote NÃO leva as peças do acervo base da Kora, nem as variantes renderizadas. O
LEIA-ME.md dentro do zip explica isso ao cliente, de frente.

Este script não apaga nada. Exportar e excluir são separados de propósito: o cliente
confere o pacote antes de perder o original.
`;

await principal();

async function principal(): Promise<void> {
  const { slug, saida } = lerArgumentos();
  const admin = clienteAdmin();

  const conteudo = await ler(admin, slug);
  const arquivos = montarPacoteDeSaida(conteudo);
  const pacote = montarZip(arquivos, new Date());

  writeFileSync(saida, pacote);

  const zonas = conteudo.produtos.reduce((soma, { zonas }) => soma + zonas.length, 0);
  const variantes = conteudo.produtos.reduce((soma, { variantes }) => soma + variantes.length, 0);
  const semAsset = conteudo.produtos.filter(({ assetBase }) => assetBase === null).length;

  console.log(`Pacote gravado: ${saida} (${(pacote.length / 1024).toFixed(1)} kB)`);
  console.log(`  tenant:     ${conteudo.tenant.nome} (${conteudo.tenant.slug})`);
  console.log(`  produtos:   ${conteudo.produtos.length}`);
  console.log(`  zonas:      ${zonas}`);
  console.log(`  variantes:  ${variantes}`);
  console.log(`  arquivos:   ${arquivos.length}`);

  // O aviso é impresso no fim, e não só no meio do log, porque é a única coisa desta saída que
  // pede uma decisão de quem operou: entregar assim, ou investigar o asset que faltou.
  if (semAsset > 0) {
    console.log(
      `\nAtenção: ${semAsset} produto(s) saíram SEM asset-base. Confira antes de entregar.`,
    );
  }

  console.log('\nNada foi apagado. A exclusão é uma operação separada, depois de o cliente');
  console.log('conferir o pacote (ADR-009 D5). Lembre o cliente de gerar as variantes pela');
  console.log('API antes de a chave dele ser revogada: elas saem como receita, não como imagem.');
}

async function ler(admin: SupabaseClient, slug: string) {
  try {
    return await lerSaidaDoTenant(admin, slug);
  } catch (erro) {
    if (erro instanceof TenantNaoEncontrado) {
      // Slug errado é o erro de digitação mais provável aqui, e a diferença entre "não existe" e
      // um stack trace é a diferença entre corrigir e abrir o código.
      console.error(`${erro.message}\n${AJUDA}`);
      process.exit(1);
    }

    throw erro;
  }
}

function lerArgumentos(): { slug: string; saida: string } {
  const bruto = process.argv.slice(2);
  const valores = new Map<string, string>();

  for (let i = 0; i < bruto.length; i += 2) {
    const chave = bruto[i];
    const valor = bruto[i + 1];
    if (chave?.startsWith('--') && valor !== undefined) valores.set(chave.slice(2), valor);
  }

  const slug = valores.get('slug');

  if (!slug) {
    console.error(`Falta o argumento --slug.\n${AJUDA}`);
    process.exit(1);
  }

  // O nome padrão leva a data para duas exportações do mesmo tenant não se sobrescreverem. Perder
  // o pacote anterior por rodar o comando duas vezes seria um jeito bobo de perder trabalho.
  const hoje = new Date().toISOString().slice(0, 10);

  return { slug, saida: valores.get('saida') ?? `saida-${slug}-${hoje}.zip` };
}

function clienteAdmin(): SupabaseClient {
  const url = process.env['SUPABASE_URL'] ?? '';
  const chave = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

  if (!url || !chave) {
    console.error(
      'Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local.',
    );
    process.exit(1);
  }

  return createClient(url, chave, { auth: { persistSession: false } });
}
