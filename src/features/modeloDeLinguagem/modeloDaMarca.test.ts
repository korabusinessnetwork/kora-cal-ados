// O adaptador entre a tela da composição e a rota `gerar`. O que ele não pode fazer: mandar
// instrução ou catálogo montados no navegador (a rota viraria modelo de uso geral pago pela marca),
// nem trocar a frase de recusa do servidor por um "tente de novo" genérico.

import { describe, expect, it } from 'vitest';

import { RecusaDoModelo } from '../../lib/composicao/gerarComposicaoPorPrompt';
import type { Forma } from '../../lib/composicao/tiposDaComposicao';
import type { FornecedorEmUso } from '../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { FalhaDaApiDoModelo, type ChamadorDaApi, type OpcoesDaChamada } from './chamarApiDoModeloDeLinguagem';
import { modeloDoFornecedorDaMarca } from './modeloDaMarca';

const TENANT = '11111111-1111-4111-8111-111111111111';
const EM_USO: FornecedorEmUso = { fornecedor: 'groq', nome_do_fornecedor: 'Groq', modelo: 'llama-3.3-70b-versatile' };
const FORMA = { id: 'prova-tenis-01' } as Forma;

function chamadorQueResponde(responder: () => unknown) {
  const chamadas: { rota: string; tenant: string; opcoes?: OpcoesDaChamada }[] = [];
  const chamar = (async (rota: string, tenant: string, opcoes?: OpcoesDaChamada) => {
    chamadas.push({ rota, tenant, opcoes });
    return responder();
  }) as ChamadorDaApi;
  return { chamar, chamadas };
}

describe('modeloDoFornecedorDaMarca', () => {
  it('manda só a forma e o prompt para `gerar`, e devolve o texto cru', async () => {
    const { chamar, chamadas } = chamadorQueResponde(() => ({ texto: '{"zonas":{}}' }));
    const modelo = modeloDoFornecedorDaMarca(chamar, TENANT, EM_USO).criar(FORMA);

    const texto = await modelo({ instrucao: 'INSTRUCAO DO NAVEGADOR', catalogo: 'CATALOGO DO NAVEGADOR', prompt: 'tênis azul' });

    expect(texto).toBe('{"zonas":{}}');
    expect(chamadas).toEqual([
      { rota: 'gerar', tenant: TENANT, opcoes: { metodo: 'POST', corpo: { forma_id: 'prova-tenis-01', prompt: 'tênis azul' } } },
    ]);
  });

  it('a recusa da API vira RecusaDoModelo com a mesma frase e o mesmo código', async () => {
    const { chamar } = chamadorQueResponde(() => {
      throw new FalhaDaApiDoModelo('TETO_MENSAL_ATINGIDO', 'O teto mensal da marca foi atingido.', 429);
    });
    const modelo = modeloDoFornecedorDaMarca(chamar, TENANT, EM_USO).criar(FORMA);

    const falha = await modelo({ instrucao: '', catalogo: '', prompt: 'tênis' }).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(RecusaDoModelo);
    expect(falha).toMatchObject({ message: 'O teto mensal da marca foi atingido.', codigo: 'TETO_MENSAL_ATINGIDO' });
  });

  it('falha que não veio da API passa como está, para virar "o modelo não respondeu"', async () => {
    const quebra = new TypeError('quebrou');
    const { chamar } = chamadorQueResponde(() => {
      throw quebra;
    });
    const modelo = modeloDoFornecedorDaMarca(chamar, TENANT, EM_USO).criar(FORMA);

    await expect(modelo({ instrucao: '', catalogo: '', prompt: 'tênis' })).rejects.toBe(quebra);
  });

  it('se apresenta como IA, com fornecedor e modelo', () => {
    const { chamar } = chamadorQueResponde(() => null);
    expect(modeloDoFornecedorDaMarca(chamar, TENANT, EM_USO).descricao).toEqual({
      ehIa: true,
      nome: 'Groq (modelo llama-3.3-70b-versatile)',
    });
  });
});
