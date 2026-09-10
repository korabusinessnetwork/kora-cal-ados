// Onde o ponteiro está vira o nome da malha que está ali (ADR-007 D4), ou nada.
//
// Este é o ADR-007 D4 virando função: o endereço de uma zona 3D é o **nome do nó**, e clicar
// numa peça precisa devolver exatamente esse nome, senão o endereço que o editor grava não é o
// mesmo que a API vai usar depois. Nome errado aqui é o análogo tridimensional do seletor que
// pega o path errado, e o princípio nº1 é explícito: zona errada falha alto, nunca pinta em
// silêncio no lugar errado.
//
// Roda sem GPU. O `Raycaster` do three trabalha sobre a geometria em memória, não sobre o que
// foi desenhado, então isto é testável em jsdom, e é por isso que a função existe fora do
// componente do palco.

import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

/** O ponteiro em coordenadas normalizadas: `-1` a `1` nos dois eixos, com a origem no centro. */
export interface PontoNormalizado {
  x: number;
  y: number;
}

/**
 * O nome do nó atingido, ou `null` se o ponteiro está no vazio.
 *
 * **Recebe o ponto já normalizado**, e não pixels mais o tamanho do canvas. Duas razões. A
 * conversão de pixel para intervalo `-1`..`1` depende de `getBoundingClientRect`, que em jsdom
 * devolve tudo zerado, então incluí-la aqui tornaria a função intestável justamente na parte que
 * importa. E converter é trabalho do componente, que é quem conhece o elemento.
 *
 * `null` e não o último nome atingido: clicar no vazio é uma resposta, não a ausência de uma.
 * Guardar o anterior faria a tela continuar afirmando que uma peça está selecionada depois de o
 * usuário ter clicado fora dela, que é justamente a "zona errada em silêncio" proibida.
 */
export function nomeDaMalhaNoPonto(
  ponto: PontoNormalizado,
  camera: Camera,
  raiz: Object3D,
): string | null {
  const raio = new Raycaster();
  raio.setFromCamera(new Vector2(ponto.x, ponto.y), camera);

  const [primeiro] = raio.intersectObject(raiz, true);
  if (primeiro === undefined) return null;

  return nomeEnderecavel(primeiro.object);
}

/**
 * O nome do **nó**, subindo a hierarquia até achar um que tenha nome.
 *
 * O `Raycaster` acerta a malha, e em glTF a malha pode estar pendurada num nó que é quem carrega
 * o nome. `normalizarModelo3d` garante que todo nó endereçável tem nome, mas o objeto que o
 * raio devolve nem sempre é esse nó: o carregador cria níveis intermediários. Subir é o que faz
 * a resposta ser o endereço que a zona guarda, e não um nome interno do carregador.
 *
 * Devolve `null` se ninguém na linhagem tem nome, em vez de inventar um: um nome inventado aqui
 * viraria um endereço de zona que não existe no modelo canônico.
 */
function nomeEnderecavel(objeto: Object3D): string | null {
  let atual: Object3D | null = objeto;

  while (atual !== null) {
    if (atual.name !== '') return atual.name;
    atual = atual.parent;
  }

  return null;
}
