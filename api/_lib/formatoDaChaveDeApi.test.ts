// O que estes testes protegem: que gerador e validador não divirjam. Se divergirem, toda
// chave já emitida para de autenticar de uma vez — e o cliente vê a integração cair sem
// que ninguém tenha "mudado" nada. É o defeito mais caro que este módulo pode ter, então
// o round-trip vem primeiro e é o teste mais importante do arquivo.

import { describe, expect, it } from 'vitest';
import {
  HASH_QUE_NUNCA_CONFERE,
  gerarChaveDeApi,
  hashDoSegredo,
  interpretarChaveDeApi,
} from './formatoDaChaveDeApi';

describe('gerarChaveDeApi + interpretarChaveDeApi (round-trip)', () => {
  it('o que o gerador produz, o validador lê de volta igual', () => {
    const gerada = gerarChaveDeApi('live');
    const lida = interpretarChaveDeApi(gerada.chave);

    expect(lida).not.toBeNull();
    expect(lida?.ambiente).toBe('live');
    expect(lida?.prefixo).toBe(gerada.prefixo);
    // A ponte inteira da autenticação: o hash guardado tem de nascer do segredo lido.
    expect(hashDoSegredo(lida?.segredo ?? '')).toBe(gerada.hash);
  });

  it('vale para os dois ambientes', () => {
    for (const ambiente of ['live', 'test'] as const) {
      const gerada = gerarChaveDeApi(ambiente);
      expect(interpretarChaveDeApi(gerada.chave)?.ambiente).toBe(ambiente);
    }
  });

  it('nunca gera a mesma chave duas vezes', () => {
    const chaves = new Set(Array.from({ length: 200 }, () => gerarChaveDeApi('live').chave));
    expect(chaves.size).toBe(200);
  });

  it('a chave nunca contém o hash, e o hash nunca contém o segredo', () => {
    const gerada = gerarChaveDeApi('live');
    const segredo = interpretarChaveDeApi(gerada.chave)?.segredo ?? '';

    // Se a chave carregasse o próprio hash, guardar o hash equivaleria a guardar a chave.
    expect(gerada.chave).not.toContain(gerada.hash);
    expect(gerada.hash).not.toContain(segredo);
  });
});

describe('segredo com `_` dentro — o modo de falha intermitente', () => {
  // O alfabeto base64url inclui `_`, que é também o separador do formato. Um validador
  // escrito como `split('_')` exigindo 4 partes recusaria cerca de metade das chaves,
  // sorteadas — passaria em qualquer teste feito com uma chave só e quebraria em produção
  // sem padrão visível. Estes dois testes existem para essa leitura nunca voltar.
  it('lê de volta 200 chaves geradas, e pelo menos uma delas tem `_` no segredo', () => {
    const geradas = Array.from({ length: 200 }, () => gerarChaveDeApi('live'));

    for (const gerada of geradas) {
      const lida = interpretarChaveDeApi(gerada.chave);
      expect(lida, `não leu de volta: ${gerada.chave}`).not.toBeNull();
      expect(hashDoSegredo(lida?.segredo ?? '')).toBe(gerada.hash);
    }

    // Canário: se o formato do segredo mudar para um alfabeto sem `_` (hex, por exemplo),
    // esta expectativa cai e avisa que o teste acima parou de exercitar o caso difícil —
    // em vez de continuar verde sem testar nada.
    const comUnderscore = geradas.filter(
      (g) => (interpretarChaveDeApi(g.chave)?.segredo ?? '').includes('_'),
    );
    expect(comUnderscore.length).toBeGreaterThan(0);
  });

  it('cinco pedaços são chave válida quando o quinto pertence ao segredo', () => {
    // Construída à mão para não depender de sorte: 43 caracteres, com `_` no meio.
    const segredo = `${'a'.repeat(21)}_${'b'.repeat(21)}`;
    expect(segredo).toHaveLength(43);

    const lida = interpretarChaveDeApi(`kora_live_7f3ab902_${segredo}`);

    expect(lida?.segredo).toBe(segredo);
    expect(lida?.prefixo).toBe('7f3ab902');
  });
});

describe('interpretarChaveDeApi recusa', () => {
  const segredo = 'k'.repeat(43);

  it.each([
    ['string vazia', ''],
    ['só o produto', 'kora'],
    ['três pedaços — falta o segredo', `kora_live_7f3ab902`],
    ['produto errado', `stripe_live_7f3ab902_${segredo}`],
    ['ambiente desconhecido', `kora_prod_7f3ab902_${segredo}`],
    ['ambiente em caixa alta', `kora_LIVE_7f3ab902_${segredo}`],
    ['prefixo curto', `kora_live_7f3ab9_${segredo}`],
    ['prefixo longo', `kora_live_7f3ab9021_${segredo}`],
    ['prefixo fora do hex', `kora_live_7f3ab9zz_${segredo}`],
    ['prefixo em caixa alta', `kora_live_7F3AB902_${segredo}`],
    ['segredo curto', `kora_live_7f3ab902_${'k'.repeat(42)}`],
    ['segredo longo', `kora_live_7f3ab902_${'k'.repeat(44)}`],
    ['segredo com caractere fora do base64url', `kora_live_7f3ab902_${'k'.repeat(42)}+`],
    ['espaço em volta', ` kora_live_7f3ab902_${segredo} `],
  ])('recusa %s', (_caso, entrada) => {
    expect(interpretarChaveDeApi(entrada)).toBeNull();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['número', 12345],
    ['objeto', { chave: `kora_live_7f3ab902_${segredo}` }],
  ])('recusa %s sem lançar — entrada de rede vira 401, não exceção', (_caso, entrada) => {
    expect(() => interpretarChaveDeApi(entrada)).not.toThrow();
    expect(interpretarChaveDeApi(entrada)).toBeNull();
  });
});

describe('hashDoSegredo', () => {
  it('é SHA-256 em hex: 64 caracteres, determinístico', () => {
    const hash = hashDoSegredo('segredo-qualquer');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoSegredo('segredo-qualquer')).toBe(hash);
  });

  it('segredos diferentes dão hashes diferentes', () => {
    expect(hashDoSegredo('a')).not.toBe(hashDoSegredo('b'));
  });
});

describe('HASH_QUE_NUNCA_CONFERE', () => {
  it('tem a forma de um hash real, para a comparação custar o mesmo tempo', () => {
    // O ponto inteiro é o tempo: se o valor tivesse outro tamanho, a comparação com
    // prefixo inexistente terminaria antes e denunciaria que o prefixo não existe.
    expect(HASH_QUE_NUNCA_CONFERE).toMatch(/^[0-9a-f]{64}$/);
    expect(HASH_QUE_NUNCA_CONFERE).toHaveLength(hashDoSegredo('qualquer').length);
  });

  it('não é o hash de nenhuma chave que a gente gere', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(gerarChaveDeApi('live').hash).not.toBe(HASH_QUE_NUNCA_CONFERE);
    }
  });
});
