// O formulário do fornecedor. Apresentacional: recebe a configuração gravada e devolve o corpo
// pronto por callback, sem saber que existe rede.
//
// A CHAVE É SÓ DE ESCRITA. O campo começa vazio sempre, mesmo com chave gravada, e o que aparece é o
// final dela. Deixar vazio mantém a gravada. É o que a D13 pede e é o que o servidor faz: a chave
// não volta ao navegador, então não há o que preencher aqui nem por engano.
//
// "Remover" pede confirmação em dois cliques no mesmo lugar, e não um `window.confirm`: o diálogo do
// navegador não segue o tema da marca e é o tipo de janela que se aprende a fechar sem ler.

import { useId, useMemo, useState, type FormEvent } from 'react';

import {
  FORNECEDORES_DE_MODELO_DE_LINGUAGEM,
  ehApiPropria,
  fornecedorPorId,
} from '../../lib/modeloDeLinguagem/fornecedoresDeModeloDeLinguagem';
import type { ConfiguracaoDoFornecedorVisivel } from '../../lib/modeloDeLinguagem/tiposDoModeloDeLinguagem';
import type { AcaoEmCurso, AvisoDaAcao, CorpoDaConfiguracao } from './hooks/useConfiguracaoDoFornecedor';
import { montarCorpoDaConfiguracao, type CamposDoFormulario } from './montarCorpoDaConfiguracao';

export interface PropsDoFormularioDoFornecedor {
  configuracao: ConfiguracaoDoFornecedorVisivel | null;
  acao: AcaoEmCurso;
  aviso: AvisoDaAcao | null;
  aoSalvar: (corpo: CorpoDaConfiguracao) => Promise<boolean>;
  aoTestar: () => void;
  aoRemover: () => void;
}

function camposIniciais(configuracao: ConfiguracaoDoFornecedorVisivel | null): CamposDoFormulario {
  const primeiro = FORNECEDORES_DE_MODELO_DE_LINGUAGEM[0];
  return {
    fornecedor: configuracao?.fornecedor ?? primeiro?.id ?? 'groq',
    modelo: configuracao?.modelo ?? primeiro?.modelosSugeridos[0] ?? '',
    chave: '',
    endereco: configuracao?.endereco ?? '',
    precoEntrada: configuracao?.endereco ? String(configuracao.preco_entrada_por_milhao) : '',
    precoSaida: configuracao?.endereco ? String(configuracao.preco_saida_por_milhao) : '',
    teto: configuracao?.teto_mensal_usd === null || configuracao === null ? '' : String(configuracao.teto_mensal_usd),
  };
}

export function FormularioDoFornecedor({
  configuracao,
  acao,
  aviso,
  aoSalvar,
  aoTestar,
  aoRemover,
}: PropsDoFormularioDoFornecedor) {
  const id = useId();
  const [campos, setCampos] = useState<CamposDoFormulario>(() => camposIniciais(configuracao));
  const [motivos, setMotivos] = useState<string[]>([]);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const fornecedor = fornecedorPorId(campos.fornecedor);
  const apiPropria = fornecedor !== undefined && ehApiPropria(fornecedor.id);
  const ocupado = acao !== 'nenhuma';

  // "Testar" confere o que está GRAVADO. Com o formulário alterado, testar agora testaria outra
  // coisa que não a que a pessoa está vendo, e o botão diz isso em vez de mentir.
  const alterado = useMemo(() => {
    const gravado = camposIniciais(configuracao);
    return (Object.keys(gravado) as (keyof CamposDoFormulario)[]).some((campo) => gravado[campo] !== campos[campo]);
  }, [campos, configuracao]);

  function mudar(campo: keyof CamposDoFormulario, valor: string) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
    setMotivos([]);
  }

  function trocarFornecedor(novo: string) {
    // O modelo sugerido acompanha o fornecedor: nome de modelo de um não existe no outro, e manter
    // o anterior seria a primeira falha do "Testar conexão".
    const escolhido = fornecedorPorId(novo);
    setCampos((atuais) => ({ ...atuais, fornecedor: novo, modelo: escolhido?.modelosSugeridos[0] ?? '' }));
    setMotivos([]);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const montado = montarCorpoDaConfiguracao(campos, configuracao !== null);
    if (!montado.valido) {
      setMotivos(montado.motivos);
      return;
    }
    const salvou = await aoSalvar(montado.corpo);
    // A chave sai do campo assim que foi aceita: ela não deve ficar parada na memória da tela.
    if (salvou) setCampos((atuais) => ({ ...atuais, chave: '' }));
  }

  return (
    <form className="fornecedor__formulario" onSubmit={(evento) => void enviar(evento)} noValidate>
      <label className="fornecedor__campo" htmlFor={`${id}-fornecedor`}>
        <span>Fornecedor</span>
        <select
          id={`${id}-fornecedor`}
          value={campos.fornecedor}
          onChange={(evento) => trocarFornecedor(evento.target.value)}
          disabled={ocupado}
        >
          {FORNECEDORES_DE_MODELO_DE_LINGUAGEM.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.id === 'api_propria' ? 'API própria (paga, compatível com OpenAI)' : `${opcao.nome} (grátis)`}
            </option>
          ))}
        </select>
      </label>

      {fornecedor && !apiPropria && (
        <p className="fornecedor__ajuda">
          {fornecedor.planoGratis}{' '}
          {fornecedor.linkDaChave && (
            <a href={fornecedor.linkDaChave} target="_blank" rel="noopener noreferrer">
              Criar a chave no site da {fornecedor.nome}
            </a>
          )}
        </p>
      )}

      {apiPropria && (
        <>
          <p className="fornecedor__ajuda">
            Qualquer serviço com a rota <code>/chat/completions</code> no formato da OpenAI. Informe o endereço base, sem
            <code>/chat/completions</code> no fim, e os preços publicados pelo serviço, que são usados para estimar o gasto.
          </p>
          <label className="fornecedor__campo" htmlFor={`${id}-endereco`}>
            <span>Endereço base</span>
            <input
              id={`${id}-endereco`}
              type="url"
              inputMode="url"
              placeholder="https://api.exemplo.com/v1"
              value={campos.endereco}
              onChange={(evento) => mudar('endereco', evento.target.value)}
              disabled={ocupado}
            />
          </label>
          <div className="fornecedor__linha">
            <label className="fornecedor__campo" htmlFor={`${id}-entrada`}>
              <span>Preço de entrada (US$ por milhão de tokens)</span>
              <input
                id={`${id}-entrada`}
                inputMode="decimal"
                placeholder="0,40"
                value={campos.precoEntrada}
                onChange={(evento) => mudar('precoEntrada', evento.target.value)}
                disabled={ocupado}
              />
            </label>
            <label className="fornecedor__campo" htmlFor={`${id}-saida`}>
              <span>Preço de saída (US$ por milhão de tokens)</span>
              <input
                id={`${id}-saida`}
                inputMode="decimal"
                placeholder="1,60"
                value={campos.precoSaida}
                onChange={(evento) => mudar('precoSaida', evento.target.value)}
                disabled={ocupado}
              />
            </label>
          </div>
        </>
      )}

      <label className="fornecedor__campo" htmlFor={`${id}-modelo`}>
        <span>Modelo</span>
        <input
          id={`${id}-modelo`}
          list={`${id}-modelos`}
          autoComplete="off"
          spellCheck={false}
          value={campos.modelo}
          onChange={(evento) => mudar('modelo', evento.target.value)}
          disabled={ocupado}
        />
        <datalist id={`${id}-modelos`}>
          {fornecedor?.modelosSugeridos.map((modelo) => <option key={modelo} value={modelo} />)}
        </datalist>
      </label>

      <label className="fornecedor__campo" htmlFor={`${id}-chave`}>
        <span>Chave</span>
        <input
          id={`${id}-chave`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            configuracao ? `Chave gravada terminando em ${configuracao.final_da_chave}. Deixe vazio para manter.` : 'Cole a chave aqui'
          }
          value={campos.chave}
          onChange={(evento) => mudar('chave', evento.target.value)}
          disabled={ocupado}
        />
      </label>

      <label className="fornecedor__campo" htmlFor={`${id}-teto`}>
        <span>Teto mensal em US$ (opcional)</span>
        <input
          id={`${id}-teto`}
          inputMode="decimal"
          placeholder="Sem teto"
          value={campos.teto}
          onChange={(evento) => mudar('teto', evento.target.value)}
          disabled={ocupado}
        />
      </label>

      {motivos.length > 0 && (
        <div className="fornecedor__aviso fornecedor__aviso--erro" role="alert">
          <p>Antes de salvar, falta acertar:</p>
          <ul>
            {motivos.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </div>
      )}

      {aviso && (
        <p
          className={`fornecedor__aviso fornecedor__aviso--${aviso.tipo}`}
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      )}

      <div className="fornecedor__acoes">
        <button type="submit" className="fornecedor__botao fornecedor__botao--principal" disabled={ocupado}>
          {acao === 'salvando' ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          className="fornecedor__botao"
          onClick={aoTestar}
          disabled={ocupado || configuracao === null || alterado}
          title={alterado ? 'Salve as alterações antes: o teste usa a configuração gravada.' : undefined}
        >
          {acao === 'testando' ? 'Testando…' : 'Testar conexão'}
        </button>
        {configuracao &&
          (confirmandoRemocao ? (
            <>
              <button
                type="button"
                className="fornecedor__botao fornecedor__botao--perigo"
                onClick={() => {
                  setConfirmandoRemocao(false);
                  aoRemover();
                }}
                disabled={ocupado}
              >
                Confirmar remoção
              </button>
              <button type="button" className="fornecedor__botao" onClick={() => setConfirmandoRemocao(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" className="fornecedor__botao" onClick={() => setConfirmandoRemocao(true)} disabled={ocupado}>
              {acao === 'removendo' ? 'Removendo…' : 'Remover fornecedor'}
            </button>
          ))}
      </div>
      {configuracao && alterado && (
        <p className="fornecedor__nota">Há alterações não salvas. O teste de conexão usa a configuração gravada.</p>
      )}
    </form>
  );
}
