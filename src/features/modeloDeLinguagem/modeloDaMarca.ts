// O fornecedor da marca no formato que a tela da composição entende (`ModeloDaTela`), D13.
//
// O modelo daqui NÃO chama o fornecedor: chama a nossa rota `gerar`, que carrega a chave cifrada,
// monta instrução e catálogo no servidor e devolve o texto cru. Por isso ele ignora `instrucao` e
// `catalogo` do pedido e manda só a forma e o prompt. O texto que volta passa pelo guarda do ADR-008
// na tela, igual ao do gerador de prova: nenhum caminho novo até o palco.
//
// A recusa da rota vira `RecusaDoModelo`, que chega à tela com a frase do nosso contrato. A frase é
// nossa (o servidor nunca repassa texto do fornecedor), e "tente de novo" seria conselho errado para
// teto mensal atingido ou chave recusada.

import { RecusaDoModelo, type ModeloDeLinguagem } from '../../lib/composicao/gerarComposicaoPorPrompt';
import type { Forma } from '../../lib/composicao/tiposDaComposicao';
import type {
  FornecedorEmUso,
  RespostaDaGeracao,
} from '../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import type { ModeloDaTela } from '../../palco3d/TelaDaComposicao';
import { FalhaDaApiDoModelo, type ChamadorDaApi } from './chamarApiDoModeloDeLinguagem';

export function modeloDoFornecedorDaMarca(
  chamar: ChamadorDaApi,
  tenantId: string,
  emUso: FornecedorEmUso,
): ModeloDaTela {
  return {
    criar: (forma: Forma): ModeloDeLinguagem =>
      async ({ prompt }) => {
        try {
          const resposta = await chamar<RespostaDaGeracao>('gerar', tenantId, {
            metodo: 'POST',
            corpo: { forma_id: forma.id, prompt },
          });
          return resposta.texto;
        } catch (falha) {
          if (falha instanceof FalhaDaApiDoModelo) throw new RecusaDoModelo(falha.message, falha.codigo);
          throw falha;
        }
      },
    // O nome do modelo vai junto do fornecedor: "Groq" sozinho não diz qual modelo respondeu, e a
    // regra de transparência é sobre quem compôs.
    descricao: { ehIa: true, nome: `${emUso.nome_do_fornecedor} (modelo ${emUso.modelo})` },
  };
}
