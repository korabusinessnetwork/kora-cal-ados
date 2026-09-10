// @vitest-environment jsdom
//
// Pelo mesmo motivo de `carregarPecaNaCena.test.ts`: carregar glTF passa pelo `FileLoader` do
// three, que dispara `ProgressEvent`, inexistente no Node puro.

import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  type Object3D,
} from 'three';

import { carregarPecaNaCena } from './carregarPecaNaCena';
import { nomeDaMalhaNoPonto } from './nomeDaMalhaNoPonto';
import { orbitaInicial, posicaoDaCamera } from './orbita';
import { catalogoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';

const IDS = catalogoDeProva().pecas.map(({ id }) => id);

/**
 * Monta cena e câmera do mesmo jeito que o palco vai montar: enquadramento derivado da peça e
 * câmera posta pela órbita inicial. Se o teste montasse a câmera à mão, ele provaria que o
 * raycast funciona numa configuração que a tela não usa.
 */
async function palcoDe(id: string, parametros: Record<string, number> = {}) {
  const { objeto, alvo, distancia } = await carregarPecaNaCena(gltfDaPecaDeProva(id, parametros));
  const cena = new Scene();
  cena.add(objeto);

  const camera = new PerspectiveCamera(45, 1, 0.01, 100);
  const posicao = posicaoDaCamera(orbitaInicial(distancia), alvo);
  camera.position.set(posicao.x, posicao.y, posicao.z);
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true);

  return { cena: cena as Object3D, camera };
}

/**
 * Uma peça no formato que o carregador produz quando o nó tem MAIS DE UMA primitiva: um grupo
 * com o nome do nó e malhas filhas sem nome. As 5 peças do acervo de prova têm uma primitiva só,
 * então nenhuma delas passa por este caminho, e sem esta montagem à mão a subida pela hierarquia
 * ficaria sem teste nenhum. Foi uma mutação que revelou isso: trocar a subida por
 * `primeiro.object.name` passava nos 10 testes que existiam.
 */
function grupoComMalhasSemNome(nomeDoNo: string): Object3D {
  const grupo = new Group();
  grupo.name = nomeDoNo;
  for (const deslocamento of [-0.3, 0.3]) {
    const malha = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), new MeshBasicMaterial());
    malha.position.x = deslocamento;
    grupo.add(malha);
  }

  return grupo;
}

/** Câmera olhando a origem de uma distância que enquadra uma caixa de meio metro. */
function cameraDeFrente(): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0.3, 0, 2);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  return camera;
}

describe('nomeDaMalhaNoPonto', () => {
  it.each(IDS)('%s é identificada pelo próprio nome quando o ponteiro está sobre ela', async (id) => {
    // O centro do quadro, porque a câmera acabou de enquadrar a peça: se ela não estiver ali, o
    // enquadramento é que está errado, e este teste pega os dois defeitos.
    const { cena, camera } = await palcoDe(id);

    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, camera, cena)).toBe(id);
  });

  it('devolve null no vazio, nunca o nome do último acerto', async () => {
    // Guardar o anterior faria a tela seguir afirmando que uma peça está selecionada depois de
    // o usuário clicar fora. É a "zona errada em silêncio" que o princípio nº1 proíbe.
    const { cena, camera } = await palcoDe('prova-sola-plana');

    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, camera, cena)).toBe('prova-sola-plana');
    expect(nomeDaMalhaNoPonto({ x: -0.99, y: 0.99 }, camera, cena)).toBeNull();
  });

  it('não lança quando a cena está vazia', async () => {
    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, new PerspectiveCamera(), new Scene())).toBeNull();
  });

  it('devolve o nome do NÓ, que é o endereço que a zona guarda', async () => {
    // ADR-007 D4: o seletor de zona 3D é lista de nomes de nó. O carregador do three cria níveis
    // intermediários, e devolver o nome de um deles daria um endereço que não existe no modelo
    // canônico. O nome tem que bater com o `nodes[].name` do glTF.
    const documento = JSON.parse(gltfDaPecaDeProva('prova-cabedal-baixo')) as {
      nodes: Array<{ name?: string }>;
    };
    const { cena, camera } = await palcoDe('prova-cabedal-baixo');

    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, camera, cena)).toBe(documento.nodes[0]?.name);
  });

  it('sobe do que o raio acertou até o nó, quando a malha atingida não tem nome', () => {
    // O caso do nó com várias primitivas. O raio acerta uma malha sem nome, e o endereço que o
    // ADR-007 D4 define é o do nó acima dela. Devolver o nome da malha daria vazio, e a tela
    // diria "nada selecionado" com o ponteiro em cima da peça.
    const cena = new Scene();
    cena.add(grupoComMalhasSemNome('peca-de-duas-primitivas'));

    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, cameraDeFrente(), cena)).toBe(
      'peca-de-duas-primitivas',
    );
  });

  it('devolve null quando ninguém na linhagem tem nome, em vez de inventar um', () => {
    // Nome inventado aqui viraria endereço de zona que não existe no modelo canônico, e a cor
    // pedida para ele nunca sairia, sem ninguém saber por quê.
    const cena = new Scene();
    const anonimo = grupoComMalhasSemNome('');
    cena.add(anonimo);

    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, cameraDeFrente(), cena)).toBeNull();
  });

  it('identifica a peça também depois de o parâmetro mudar o tamanho dela', async () => {
    // O nome é do nó e a escala é do nó, então mexer num não pode mexer no outro. Se algum dia
    // o parâmetro voltar a remodelar a malha, o nome pode vir a mudar junto sem ninguém notar.
    const { cena, camera } = await palcoDe('prova-sola-plana', { espessura: 0.04 });

    expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, camera, cena)).toBe('prova-sola-plana');
  });

  it('acerta a peça de vários ângulos de órbita, não só do inicial', async () => {
    // Enquadramento e órbita conversam: girar não pode jogar a peça para fora do centro do
    // quadro. Se jogasse, clicar no meio da tela erraria a peça depois de o usuário girar.
    const { objeto, alvo, distancia } = await carregarPecaNaCena(gltfDaPecaDeProva('prova-cabedal-cano-alto'));
    const cena = new Scene();
    cena.add(objeto);
    const camera = new PerspectiveCamera(45, 1, 0.01, 100);

    for (const azimute of [0, 1, 2, 3, 4, 5, 6]) {
      const posicao = posicaoDaCamera({ azimute, elevacao: Math.PI / 2.6, distancia }, alvo);
      camera.position.set(posicao.x, posicao.y, posicao.z);
      camera.lookAt(alvo);
      camera.updateMatrixWorld(true);

      expect(nomeDaMalhaNoPonto({ x: 0, y: 0 }, camera, cena as Object3D)).toBe('prova-cabedal-cano-alto');
    }
  });
});
