// A política de nome é o que torna uma zona 3D endereçável. Um nome instável entre execuções
// repointaria um seletor já gravado no banco — e a zona passaria a pintar outra peça sem
// ninguém ver. Por isso os casos aqui são todos sobre ESTABILIDADE, não sobre estética.

import { describe, expect, it } from 'vitest';
import { aplicarPoliticaDeNome, type RelatorioDeNome } from './nomeDeMalha';
import type { NoDoGltf } from './tiposDoGltf';

function aplicar(nos: NoDoGltf[], enderecaveis: number[]) {
  const relatorio: RelatorioDeNome = { nomesRenomeados: [], nomesAtribuidos: [] };
  aplicarPoliticaDeNome(nos, new Set(enderecaveis), relatorio);
  return { nomes: nos.map((no) => no.name), relatorio };
}

describe('nome que o modelador escreveu', () => {
  it('é preservado quando já é único e seguro', () => {
    const { nomes, relatorio } = aplicar([{ name: 'sola', mesh: 0 }], [0]);

    expect(nomes).toEqual(['sola']);
    expect(relatorio.nomesRenomeados).toEqual([]);
    expect(relatorio.nomesAtribuidos).toEqual([]);
  });

  it('colisão vira nome e nome-2, e quem vem primeiro no documento fica com o original', () => {
    const { nomes, relatorio } = aplicar(
      [{ name: 'sola', mesh: 0 }, { name: 'sola', mesh: 1 }, { name: 'sola', mesh: 2 }],
      [0, 1, 2],
    );

    expect(nomes).toEqual(['sola', 'sola-2', 'sola-3']);
    expect(relatorio.nomesRenomeados).toEqual([
      { de: 'sola', para: 'sola-2' },
      { de: 'sola', para: 'sola-3' },
    ]);
  });

  it('nome com vírgula é convertido — vírgula parte a lista de nomes em dois endereços', () => {
    // Este é o modo de falha que a política existe para impedir: o seletor de zona é uma
    // LISTA de nomes; um nome que contenha o separador vira dois endereços errados.
    const { nomes, relatorio } = aplicar([{ name: 'sola, externa', mesh: 0 }], [0]);

    expect(nomes[0]).toBe('sola--externa');
    expect(relatorio.nomesRenomeados).toEqual([{ de: 'sola, externa', para: 'sola--externa' }]);
  });

  it('nome que começa com dígito ganha prefixo, porque nome não pode virar número', () => {
    expect(aplicar([{ name: '3M-logo', mesh: 0 }], [0]).nomes[0]).toBe('malha-3M-logo');
  });
});

describe('nome cunhado em nó anônimo', () => {
  it('vira malha-N na ordem do documento', () => {
    const { nomes, relatorio } = aplicar([{ mesh: 0 }, { mesh: 1 }], [0, 1]);

    expect(nomes).toEqual(['malha-1', 'malha-2']);
    expect(relatorio.nomesAtribuidos).toEqual(['malha-1', 'malha-2']);
  });

  it('trata name vazio como ausente', () => {
    expect(aplicar([{ name: '', mesh: 0 }], [0]).nomes[0]).toBe('malha-1');
  });

  it('pula o número que o modelador já ocupou', () => {
    // Sem isto, o cunhador emitiria `malha-1` duas vezes e duas zonas teriam o mesmo endereço.
    const { nomes } = aplicar([{ name: 'malha-1', mesh: 0 }, { mesh: 1 }], [0, 1]);

    expect(nomes).toEqual(['malha-1', 'malha-2']);
  });

  it('NÃO cunha em nó sem malha, nem gasta número com ele', () => {
    // Cunhar numa junta de esqueleto deslocaria o nome de todas as malhas seguintes — e nome
    // deslocado repointa seletor já gravado.
    const { nomes, relatorio } = aplicar([{}, { mesh: 0 }, {}, { mesh: 1 }], [1, 3]);

    expect(nomes).toEqual([undefined, 'malha-1', undefined, 'malha-2']);
    expect(relatorio.nomesAtribuidos).toEqual(['malha-1', 'malha-2']);
  });

  it('nó sem malha COM nome ainda ocupa o nome, para a malha não colidir com ele', () => {
    const { nomes } = aplicar([{ name: 'sola' }, { name: 'sola', mesh: 0 }], [1]);

    expect(nomes).toEqual(['sola', 'sola-2']);
  });
});
