import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  ChaveCifradaIlegivel,
  CifraNaoConfigurada,
  cifrarChaveDoFornecedor,
  decifrarChaveDoFornecedor,
  finalDaChave,
  lerChaveDeCifra,
} from './cifraDaChaveDoFornecedor';

const CHAVE_DE_CIFRA = randomBytes(32);
const CHAVE = 'gsk_MinhaChaveDoFornecedor1234';

describe('cifrar e decifrar a chave do fornecedor', () => {
  it('a chave volta igual depois de uma volta completa', () => {
    expect(decifrarChaveDoFornecedor(cifrarChaveDoFornecedor(CHAVE, CHAVE_DE_CIFRA), CHAVE_DE_CIFRA)).toBe(CHAVE);
  });

  it('o texto gravado não contém a chave, nem pedaço dela', () => {
    // O ponto inteiro da cifra: um dump da tabela não entrega a chave.
    const gravado = cifrarChaveDoFornecedor(CHAVE, CHAVE_DE_CIFRA);
    expect(gravado).not.toContain(CHAVE);
    expect(gravado).not.toContain('MinhaChave');
    expect(gravado.startsWith('v1.')).toBe(true);
  });

  it('cifrar duas vezes a mesma chave dá textos diferentes (nonce novo a cada vez)', () => {
    // Sem isso, duas marcas com a mesma chave teriam a mesma linha, e dava para comparar.
    expect(cifrarChaveDoFornecedor(CHAVE, CHAVE_DE_CIFRA)).not.toBe(cifrarChaveDoFornecedor(CHAVE, CHAVE_DE_CIFRA));
  });

  it('chave de cifra diferente não abre o texto', () => {
    const gravado = cifrarChaveDoFornecedor(CHAVE, CHAVE_DE_CIFRA);
    expect(() => decifrarChaveDoFornecedor(gravado, randomBytes(32))).toThrow(ChaveCifradaIlegivel);
  });

  it('texto adulterado não abre, porque o selo do GCM confere', () => {
    const [versao, nonce, selo, texto] = cifrarChaveDoFornecedor(CHAVE, CHAVE_DE_CIFRA).split('.') as string[];
    const trocado = `${texto?.slice(0, -2)}${texto?.slice(-2) === 'AA' ? 'AB' : 'AA'}`;

    expect(() => decifrarChaveDoFornecedor([versao, nonce, selo, trocado].join('.'), CHAVE_DE_CIFRA)).toThrow(
      ChaveCifradaIlegivel,
    );
  });

  it('formato estranho e versão desconhecida não abrem', () => {
    for (const gravado of ['', 'gsk_chaveemclaro', 'v2.a.b.c', 'v1.a.b']) {
      expect(() => decifrarChaveDoFornecedor(gravado, CHAVE_DE_CIFRA), gravado).toThrow(ChaveCifradaIlegivel);
    }
  });

  it('a mensagem do erro não conta o motivo, para não ajudar quem está adivinhando', () => {
    try {
      decifrarChaveDoFornecedor('v1.a.b.c', CHAVE_DE_CIFRA);
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect((erro as Error).message).toMatch(/Grave a chave de novo/);
      expect((erro as Error).message).not.toMatch(/tag|auth|OpenSSL|nonce/i);
    }
  });
});

describe('lerChaveDeCifra', () => {
  it('lê a chave de 32 bytes em base64 do ambiente', () => {
    const valor = CHAVE_DE_CIFRA.toString('base64');
    expect(lerChaveDeCifra({ CHAVE_DE_CIFRA_DOS_FORNECEDORES: ` ${valor} ` }).equals(CHAVE_DE_CIFRA)).toBe(true);
  });

  it('recusa ausente e recusa tamanho errado, dizendo como gerar uma', () => {
    expect(() => lerChaveDeCifra({})).toThrow(CifraNaoConfigurada);
    expect(() => lerChaveDeCifra({ CHAVE_DE_CIFRA_DOS_FORNECEDORES: randomBytes(16).toString('base64') })).toThrow(
      /32 bytes/,
    );
    expect(() => lerChaveDeCifra({})).toThrow(/NÃO leva prefixo VITE_/);
  });
});

describe('finalDaChave', () => {
  it('são os 4 últimos caracteres, e não os primeiros', () => {
    expect(finalDaChave('gsk_abcdefgh1234')).toBe('1234');
    // Chave curta demais não quebra: a tela só mostra menos caracteres.
    expect(finalDaChave('abc')).toBe('abc');
  });
});
