// Semeia, no produto de demonstração, dois estados que o EDITOR SE RECUSA A CRIAR — e que o
// banco pode ter mesmo assim: uma zona de gradiente e um par de zonas sobrepostas.
//
// Por que isso precisa existir: desde a Etapa 4 o editor recusa no clique tanto o elemento
// que não aceita cor chapa quanto o elemento que já pertence a outra zona. Ótimo para quem
// marca — e péssimo para verificar os caminhos de falha, que passariam a ser inalcançáveis
// pela tela. Só que eles continuam alcançáveis na vida real: mapeamento gravado antes desta
// regra, importação futura, correção manual no banco. Se a tela reagir mal a isso, ninguém
// descobre, porque ninguém consegue produzir o estado clicando.
//
// Uso (service_role, nunca no front):
//   npm run semear-zonas -- --produto <uuid> [--limpar]

import { createClient } from '@supabase/supabase-js';
import '../../src/lib/render/domNode';
import { analisarSvg } from '../../src/lib/render/dom';
import { montarSeletorDeZona } from '../../src/lib/render/montarSeletorDeZona';
import { BUCKET_DO_ASSET_BASE } from './caminhoDoAssetBase';

const argumentos = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const chave = process.argv[i];
  if (chave?.startsWith('--')) argumentos.set(chave.slice(2), process.argv[i + 1] ?? 'sim');
}

const productId = argumentos.get('produto');
if (!productId) {
  console.error('Uso: npm run semear-zonas -- --produto <uuid> [--limpar]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? '';
const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !servico) {
  console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const admin = createClient(url, servico, { auth: { persistSession: false } });

const produto = await admin
  .from('products')
  .select('id, tenant_id, base_asset_path')
  .eq('id', productId)
  .single();

if (produto.error || !produto.data) throw produto.error ?? new Error('produto não encontrado');

if (argumentos.has('limpar')) {
  const apagadas = await admin
    .from('product_zones')
    .delete()
    .eq('product_id', productId)
    .in('zone_key', ['detalhe-gradiente', 'sobreposta']);
  if (apagadas.error) throw apagadas.error;
  console.log('Zonas de teste removidas.');
  process.exit(0);
}

// O SVG é lido do Storage, não montado aqui: os ids que vão para o seletor precisam ser os
// do arquivo que o navegador vai receber, senão a semeadura testa outra coisa.
const baixado = await admin.storage
  .from(BUCKET_DO_ASSET_BASE)
  .download(produto.data.base_asset_path);
if (baixado.error) throw baixado.error;

const documento = analisarSvg(await baixado.data.text());

/** Um elemento pintado com gradiente: o motor recusa achatá-lo (ADR-004, decisão 1). */
const comGradiente = [...documento.querySelectorAll('[id]')].find((elemento) =>
  (elemento.getAttribute('fill') ?? '').trim().startsWith('url('),
);

/** Um elemento que JÁ pertence à zona `ilhos`, para produzir sobreposição de propósito. */
const jaMarcado = await admin
  .from('product_zones')
  .select('zone_key, svg_selector')
  .eq('product_id', productId)
  .limit(1)
  .maybeSingle();

const semear: Array<{ zone_key: string; svg_selector: string; label: string }> = [];

if (comGradiente) {
  semear.push({
    zone_key: 'detalhe-gradiente',
    svg_selector: montarSeletorDeZona([comGradiente.getAttribute('id') ?? '']),
    label: 'Detalhe com gradiente',
  });
}

if (jaMarcado.data) {
  const primeiro = jaMarcado.data.svg_selector.split(',')[0]?.trim().replace('#', '');
  if (primeiro) {
    semear.push({
      zone_key: 'sobreposta',
      svg_selector: montarSeletorDeZona([primeiro]),
      label: `Sobrepõe "${jaMarcado.data.zone_key}" de propósito`,
    });
  }
}

for (const zona of semear) {
  const { error } = await admin
    .from('product_zones')
    .insert({ ...zona, product_id: productId, tenant_id: produto.data.tenant_id });
  if (error && error.code !== '23505') throw error;
  console.log(`${error ? 'já existia' : 'semeada'}: ${zona.zone_key} → ${zona.svg_selector}`);
}

if (semear.length === 0) console.log('Nada a semear: o asset não tem gradiente e não há zona.');
