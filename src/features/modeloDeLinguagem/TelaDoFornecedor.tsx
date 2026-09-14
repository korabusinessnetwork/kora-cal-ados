// A tela "Fornecedor de modelo de linguagem" da marca: escolher o fornecedor, colar a chave, testar, e ver o gasto.
//
// SÓ O OWNER. A navegação já esconde a entrada de quem é membro, e esta tela confere de novo porque
// esconder botão não é permissão. A permissão de verdade é do servidor, que responde 403 a membro
// nas quatro rotas; a conferência daqui só evita desenhar um formulário que vai ser recusado.

import { useMemo, useState } from 'react';

import { mesEmUtc } from '../../lib/modeloDeLinguagem/resumirUsoDoMes';
import { clienteSupabase } from '../../lib/supabase/cliente';
import type { TenantDoUsuario } from '../sessao/carregarTenantsDoUsuario';
import {
  criarChamadorDaApi,
  lerTokenDoCliente,
  type ChamadorDaApi,
} from './chamarApiDoModeloDeLinguagem';
import { FormularioDoFornecedor } from './FormularioDoFornecedor';
import { useConfiguracaoDoFornecedor } from './hooks/useConfiguracaoDoFornecedor';
import { useUsoDoMes } from './hooks/useUsoDoMes';
import { PainelDeGasto } from './PainelDeGasto';

export interface PropsDaTelaDoFornecedor {
  tenant: TenantDoUsuario;
  /** Injetável para teste. Em produção, a API com o token da sessão Supabase. */
  chamar?: ChamadorDaApi;
}

export function TelaDoFornecedor({ tenant, chamar }: PropsDaTelaDoFornecedor) {
  if (tenant.papel !== 'owner') {
    return (
      <main className="fornecedor">
        <h1 className="fornecedor__titulo">Fornecedor de modelo de linguagem</h1>
        <p className="fornecedor__vazio">
          Só o owner da marca escolhe o fornecedor e vê o gasto. Peça a quem é owner da {tenant.nome} se precisar mudar algo.
        </p>
      </main>
    );
  }

  return <TelaDoOwner tenant={tenant} chamar={chamar} />;
}

function TelaDoOwner({ tenant, chamar }: PropsDaTelaDoFornecedor) {
  // Criado uma vez por montagem: os hooks leem `chamar` por referência (ver `useConfiguracaoDoFornecedor`).
  const chamador = useMemo(
    () => chamar ?? criarChamadorDaApi({ lerToken: lerTokenDoCliente(clienteSupabase()) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [mes, setMes] = useState(() => mesEmUtc(new Date()));

  const leitura = useConfiguracaoDoFornecedor(tenant.id, chamador);
  const uso = useUsoDoMes(tenant.id, mes, chamador);

  return (
    <main className="fornecedor">
      <h1 className="fornecedor__titulo">Fornecedor de modelo de linguagem</h1>
      <p className="fornecedor__intro">
        O &quot;Compor calçado&quot; usa o fornecedor escolhido aqui, com a chave da {tenant.nome}. Os fornecedores da lista
        têm plano grátis; a API própria é paga e usa os preços que você informar. A chave fica cifrada no servidor e nunca
        volta para a tela.
      </p>

      <section className="fornecedor__secao" aria-labelledby="fornecedor-configuracao">
        <h2 id="fornecedor-configuracao" className="fornecedor__subtitulo">
          Configuração
        </h2>

        {leitura.estado === 'carregando' && (
          <p className="fornecedor__vazio" aria-busy="true">
            Carregando a configuração…
          </p>
        )}

        {leitura.estado === 'erro' && (
          <div className="fornecedor__erro" role="alert">
            <p>{leitura.erro ?? 'Não foi possível carregar a configuração.'}</p>
            <button type="button" onClick={leitura.recarregar}>
              Tentar de novo
            </button>
          </div>
        )}

        {leitura.estado === 'pronta' && (
          <>
            <p className="fornecedor__situacao">
              {leitura.configuracao
                ? `Em uso: ${leitura.configuracao.modelo}, chave terminando em ${leitura.configuracao.final_da_chave}.`
                : 'Nenhum fornecedor configurado. Até configurar, o "Compor calçado" usa o gerador de prova, que não é IA.'}
            </p>
            <FormularioDoFornecedor
              // Remonta o formulário quando a configuração gravada muda (salvar ou remover), para
              // os campos voltarem a espelhar o que está no servidor.
              key={leitura.configuracao?.updated_at ?? 'sem-configuracao'}
              configuracao={leitura.configuracao}
              acao={leitura.acao}
              aviso={leitura.aviso}
              aoSalvar={async (corpo) => {
                const salvou = await leitura.salvar(corpo);
                if (salvou) uso.recarregar();
                return salvou;
              }}
              aoTestar={() => void leitura.testar().then(uso.recarregar)}
              aoRemover={() => void leitura.remover()}
            />
          </>
        )}
      </section>

      <PainelDeGasto
        estado={uso.estado}
        resumo={uso.resumo}
        erro={uso.erro}
        mes={mes}
        aoTrocarMes={setMes}
        aoRecarregar={uso.recarregar}
      />
    </main>
  );
}
