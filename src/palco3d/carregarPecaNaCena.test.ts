// @vitest-environment jsdom
//
// jsdom e não o ambiente padrão porque o `FileLoader` do three dispara um `ProgressEvent` ao
// terminar de ler o `data:` URI do buffer, e `ProgressEvent` não existe no Node puro. Sem esta
// linha os testes deste arquivo penduram e o vitest reporta "unhandled rejection" sem dizer por
// quê. Descoberto por sonda antes do build.

import { describe, expect, it } from 'vitest';
import { Vector3, type Mesh, type Object3D } from 'three';

import { carregarPecaNaCena, enquadrar } from './carregarPecaNaCena';
import { catalogoDeProva, gltfDaPecaDeProva } from '../lib/acervo/acervoDeProva';

const CATALOGO = catalogoDeProva();
const IDS = CATALOGO.pecas.map(({ id }) => id);

function malhas(objeto: Object3D): Mesh[] {
  const encontradas: Mesh[] = [];
  objeto.traverse((no) => {
    if ((no as Mesh).isMesh) encontradas.push(no as Mesh);
  });

  return encontradas;
}

describe('carregarPecaNaCena', () => {
  it.each(IDS)('%s vira exatamente uma malha, com o id da peça como nome', async (id) => {
    // Uma malha e não várias: cada peça do acervo é uma zona (ADR-008 D3), e uma peça que
    // chegasse partida em duas malhas seria duas zonas com o mesmo papel.
    const { objeto } = await carregarPecaNaCena(gltfDaPecaDeProva(id));
    const encontradas = malhas(objeto);

    expect(encontradas).toHaveLength(1);
    expect(encontradas[0]?.name).toBe(id);
  });

  it.each(IDS)('%s chega na cena com as dimensões que o acervo declara, em metros', async (id) => {
    // Prova que a unidade sobreviveu a caixa, buffer, base64, glTF e carregador. Um fator 100
    // perdido no caminho põe um calçado de 28 metros na cena, e a câmera enquadra assim mesmo,
    // então isto NÃO apareceria a olho.
    const peca = CATALOGO.pecas.find((candidata) => candidata.id === id);
    const parametro = peca?.parametros[0];
    const { caixa } = await carregarPecaNaCena(gltfDaPecaDeProva(id));
    const tamanho = caixa.getSize(new Vector3());

    expect(tamanho.y).toBeCloseTo(parametro?.padrao ?? 0, 6);
    expect(tamanho.x).toBeGreaterThan(0.05);
    expect(tamanho.x).toBeLessThan(0.4);
  });

  it.each(IDS)('%s assenta com a base no chão, e não centrada na origem', async (id) => {
    // A peça é modelada com a base na origem e depois transladada para onde assenta na forma.
    // Se ela chegasse centrada, engrossar a sola a afundaria no chão.
    const { caixa } = await carregarPecaNaCena(gltfDaPecaDeProva(id));

    expect(caixa.min.y).toBeGreaterThanOrEqual(0);
  });

  it('o parâmetro chega ao mundo como altura de verdade', async () => {
    const parametro = CATALOGO.pecas.find(({ id }) => id === 'prova-sola-plana')?.parametros[0];
    const alturaCom = async (valor: number): Promise<number> => {
      const { caixa } = await carregarPecaNaCena(
        gltfDaPecaDeProva('prova-sola-plana', { [parametro?.nome ?? '']: valor }),
      );

      return caixa.getSize(new Vector3()).y;
    };

    const fina = await alturaCom(parametro?.minimo ?? 0);
    const grossa = await alturaCom(parametro?.maximo ?? 0);

    expect(fina).toBeCloseTo(parametro?.minimo ?? 0, 6);
    expect(grossa).toBeCloseTo(parametro?.maximo ?? 0, 6);
    expect(grossa).toBeGreaterThan(fina);
  });

  it('engrossar a peça a faz crescer para cima, nunca para baixo', async () => {
    // O teste que a caixa envolvente sozinha não daria: comparar o piso das duas versões. Se a
    // escala fosse em volta do centro do volume, a peça grossa teria `min.y` negativo.
    const parametro = CATALOGO.pecas.find(({ id }) => id === 'prova-sola-plana')?.parametros[0];
    const nome = parametro?.nome ?? '';

    const fina = await carregarPecaNaCena(gltfDaPecaDeProva('prova-sola-plana', { [nome]: parametro?.minimo ?? 0 }));
    const grossa = await carregarPecaNaCena(gltfDaPecaDeProva('prova-sola-plana', { [nome]: parametro?.maximo ?? 0 }));

    expect(grossa.caixa.min.y).toBeCloseTo(fina.caixa.min.y, 9);
    expect(grossa.caixa.max.y).toBeGreaterThan(fina.caixa.max.y);
  });

  it('recusa texto que não é glTF, em vez de devolver cena vazia', async () => {
    // Cena vazia com sucesso é o BUG-001 outra vez por outro caminho: nada na tela e nenhum
    // aviso. Recusar é a resposta que este projeto dá desde o ADR-004.
    await expect(carregarPecaNaCena('isto não é glTF nenhum')).rejects.toThrow();
  });
});

describe('enquadrar', () => {
  it.each(IDS)('%s recebe uma distância proporcional ao próprio tamanho', async (id) => {
    // Distância fixa faria o cadarço (0,13 m) virar um ponto enquanto a sola (0,28 m) estoura o
    // quadro. A distância sai da caixa envolvente, então toda peça preenche o quadro igual.
    const { caixa, distancia } = await carregarPecaNaCena(gltfDaPecaDeProva(id));
    const tamanho = caixa.getSize(new Vector3());
    const maior = Math.max(tamanho.x, tamanho.y, tamanho.z);

    expect(distancia).toBeGreaterThan(maior);
    expect(distancia / maior).toBeCloseTo(2.2, 6);
  });

  it('a peça menor fica mais perto da câmera que a maior', async () => {
    const cadarco = await carregarPecaNaCena(gltfDaPecaDeProva('prova-cadarco-reto'));
    const sola = await carregarPecaNaCena(gltfDaPecaDeProva('prova-sola-plana'));

    expect(cadarco.distancia).toBeLessThan(sola.distancia);
  });

  it('a câmera olha para o centro da peça, não para a origem', async () => {
    // O cadarço assenta deslocado para a biqueira e acima do cabedal. Se o alvo fosse a origem,
    // ele apareceria num canto do quadro em vez de no meio.
    const { alvo, caixa } = await carregarPecaNaCena(gltfDaPecaDeProva('prova-cadarco-reto'));

    expect(alvo).toEqual(caixa.getCenter(new Vector3()));
    expect(alvo.y).toBeGreaterThan(0);
  });

  it('a folga cabe a peça girada de viés, que é mais larga que de frente', async () => {
    // Uma caixa vista pela diagonal mede `sqrt(2)` vezes a face. A folga tem que passar disso,
    // senão a peça encosta na borda no meio do giro.
    const { caixa, distancia } = await carregarPecaNaCena(gltfDaPecaDeProva('prova-sola-plana'));
    const tamanho = caixa.getSize(new Vector3());
    const diagonal = Math.hypot(tamanho.x, tamanho.z);

    expect(distancia).toBeGreaterThan(diagonal);
  });
});
