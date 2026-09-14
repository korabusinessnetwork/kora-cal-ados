// A configuração do fornecedor da marca, e as três ações sobre ela: salvar, testar e remover.
//
// Leitura e ação são estados separados de propósito. Uma falha ao TESTAR não pode apagar a
// configuração da tela, e uma leitura que falhou não pode deixar o formulário aberto como se não
// houvesse nada gravado: "nada configurado" e "não consegui ler" são frases diferentes, e só uma é
// verdade de cada vez.

import { useCallback, useEffect, useState } from 'react';

import type {
  ConfiguracaoDoFornecedorVisivel,
  RespostaDoTeste,
} from '../../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import { mensagemDaFalha, type ChamadorDaApi } from '../chamarApiDoModeloDeLinguagem';

export type EstadoDaLeitura = 'carregando' | 'erro' | 'pronta';
export type AcaoEmCurso = 'nenhuma' | 'salvando' | 'testando' | 'removendo';

export interface AvisoDaAcao {
  tipo: 'sucesso' | 'erro';
  texto: string;
}

/** O corpo do `PUT`, no formato do contrato. `chave: null` mantém a chave gravada. */
export interface CorpoDaConfiguracao {
  fornecedor: string;
  modelo: string;
  chave: string | null;
  endereco: string | null;
  preco_entrada_por_milhao: number | null;
  preco_saida_por_milhao: number | null;
  teto_mensal_usd: number | null;
}

export interface ConfiguracaoDoFornecedorCarregada {
  estado: EstadoDaLeitura;
  configuracao: ConfiguracaoDoFornecedorVisivel | null;
  erro: string | null;
  acao: AcaoEmCurso;
  aviso: AvisoDaAcao | null;
  recarregar: () => void;
  salvar: (corpo: CorpoDaConfiguracao) => Promise<boolean>;
  testar: () => Promise<void>;
  remover: () => Promise<void>;
}

export function useConfiguracaoDoFornecedor(
  tenantId: string,
  chamar: ChamadorDaApi,
): ConfiguracaoDoFornecedorCarregada {
  const [estado, setEstado] = useState<EstadoDaLeitura>('carregando');
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDoFornecedorVisivel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<AcaoEmCurso>('nenhuma');
  const [aviso, setAviso] = useState<AvisoDaAcao | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    // `vivo`: a resposta de uma leitura antiga não pode pintar a tela depois de trocar de marca.
    let vivo = true;
    setEstado('carregando');
    setErro(null);

    chamar<{ configuracao: ConfiguracaoDoFornecedorVisivel | null }>('configuracao', tenantId)
      .then((dados) => {
        if (!vivo) return;
        setConfiguracao(dados.configuracao);
        setEstado('pronta');
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        setErro(mensagemDaFalha(falha));
        setEstado('erro');
      });

    return () => {
      vivo = false;
    };
    // `chamar` fica fora de propósito, pelo mesmo motivo do cliente em `useProdutos`: quem o criar
    // na própria linha daria identidade nova a cada render e a leitura se repetiria para sempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, versao]);

  const recarregar = useCallback(() => setVersao((atual) => atual + 1), []);

  const salvar = useCallback(
    async (corpo: CorpoDaConfiguracao) => {
      setAcao('salvando');
      setAviso(null);
      try {
        const dados = await chamar<{ configuracao: ConfiguracaoDoFornecedorVisivel }>('configuracao', tenantId, {
          metodo: 'PUT',
          corpo,
        });
        setConfiguracao(dados.configuracao);
        setAviso({ tipo: 'sucesso', texto: 'Configuração salva. Use "Testar conexão" para confirmar que a chave e o modelo funcionam.' });
        return true;
      } catch (falha) {
        setAviso({ tipo: 'erro', texto: mensagemDaFalha(falha) });
        return false;
      } finally {
        setAcao('nenhuma');
      }
    },
    [chamar, tenantId],
  );

  const testar = useCallback(async () => {
    setAcao('testando');
    setAviso(null);
    try {
      const dados = await chamar<RespostaDoTeste>('testar', tenantId, { metodo: 'POST' });
      setAviso({
        tipo: 'sucesso',
        texto: `Conexão funcionando: o modelo ${dados.modelo} respondeu em ${dados.milissegundos} ms.`,
      });
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: mensagemDaFalha(falha) });
    } finally {
      setAcao('nenhuma');
    }
  }, [chamar, tenantId]);

  const remover = useCallback(async () => {
    setAcao('removendo');
    setAviso(null);
    try {
      await chamar('configuracao', tenantId, { metodo: 'DELETE' });
      setConfiguracao(null);
      setAviso({
        tipo: 'sucesso',
        texto: 'Fornecedor removido. "Compor calçado" volta a usar o gerador de prova, e o histórico de gasto continua no painel.',
      });
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: mensagemDaFalha(falha) });
    } finally {
      setAcao('nenhuma');
    }
  }, [chamar, tenantId]);

  return { estado, configuracao, erro, acao, aviso, recarregar, salvar, testar, remover };
}
