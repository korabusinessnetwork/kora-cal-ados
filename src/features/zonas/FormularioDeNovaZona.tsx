// O formulário que dá nome à zona recém-marcada: `zone_key`, `label` e `cor_default`.
// Componente burro e controlado — todo o estado vem por props, como `ListaDeProdutos`.
// É o que permite testar a validação inteira com `renderToStaticMarkup`, sem rede.
//
// Por que a validação acontece AQUI, e com as mesmas funções do motor: `zone_key` e cor
// viram contrato com o cliente da API no minuto seguinte. Rodar `validarZoneKey` e
// `validarCor` (nunca uma segunda implementação das regras de slug/hex, que divergiria)
// antes de o banco ver qualquer coisa é prevenção de erro > mensagem de erro (CLAUDE.md):
// o salvar fica desabilitado com o motivo escrito, em vez de o Postgres recusar depois.

import type { FormEvent, ReactElement } from 'react';
import { ErroDeVariante } from '../../lib/render/erros';
import { contarElementos } from '../../lib/texto/contarElementos';
import { validarCor } from '../../lib/render/validarCor';
import { sugerirZoneKey, validarZoneKey } from '../../lib/render/validarZoneKey';

export interface PropsDoFormularioDeNovaZona {
  /** O que a pessoa digitou como nome legível ("Cadarço lateral"). */
  rotulo: string;
  /** A chave pública da API. */
  zoneKey: string;
  /** Cor padrão, opcional — string vazia = sem cor padrão. */
  corDefault: string;
  /** Quantos elementos estão marcados no palco agora. */
  quantidadeMarcada: number;
  /** Zona já gravada com essa chave: o salvar vira "adicionar à zona". */
  zonaExistente: boolean;
  salvando: boolean;
  /** Erro vindo do banco (ex.: a tradução do 23505). */
  erro: string | null;
  aoMudarRotulo(valor: string): void;
  aoMudarZoneKey(valor: string): void;
  aoMudarCorDefault(valor: string): void;
  aoSalvar(): void;
  aoCancelar(): void;
}

export function FormularioDeNovaZona(props: PropsDoFormularioDeNovaZona): ReactElement {
  const { rotulo, zoneKey, corDefault, quantidadeMarcada, zonaExistente, salvando, erro } = props;

  const erroDaChave = mensagemDoMotor(() => validarZoneKey(zoneKey));
  // Cor vazia é ausência de cor padrão, não erro: `cor_default` é opcional na tabela.
  const erroDaCor =
    corDefault.trim() === '' ? null : mensagemDoMotor(() => validarCor(corDefault, zoneKey.trim()));

  const sugestao = sugerirZoneKey(rotulo);
  const semElemento = quantidadeMarcada === 0;
  const podeSalvar = erroDaChave === null && erroDaCor === null && !semElemento && !salvando;

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (podeSalvar) props.aoSalvar();
  }

  return (
    <form className="zona-form" onSubmit={handleSubmit} aria-busy={salvando}>
      {erro !== null && (
        <p className="zonas__erro" role="alert">
          {erro}
        </p>
      )}

      <p className="zona-form__contagem">
        {contarElementos(quantidadeMarcada, { singular: 'marcado', plural: 'marcados' })}
      </p>

      <div className="zona-form__campo">
        <label className="zona-form__rotulo" htmlFor="zona-form-rotulo">
          Nome da zona
        </label>
        <input
          id="zona-form-rotulo"
          name="rotulo"
          type="text"
          value={rotulo}
          disabled={salvando}
          aria-describedby="zona-form-rotulo-ajuda"
          onChange={(evento) => props.aoMudarRotulo(evento.target.value)}
        />
        <p className="zona-form__ajuda" id="zona-form-rotulo-ajuda">
          Nome legível, só para o time — não vai para a API.
        </p>
      </div>

      <div className="zona-form__campo">
        <label className="zona-form__rotulo" htmlFor="zona-form-zone-key">
          Chave da API (zone_key)
        </label>
        <input
          id="zona-form-zone-key"
          name="zone_key"
          type="text"
          value={zoneKey}
          disabled={salvando}
          aria-invalid={erroDaChave !== null}
          aria-describedby={descrever('zona-form-zone-key', erroDaChave)}
          onChange={(evento) => props.aoMudarZoneKey(evento.target.value)}
        />
        <p className="zona-form__ajuda" id="zona-form-zone-key-ajuda">
          É esta a chave que o cliente vai mandar no JSON da API:{' '}
          <code>{'{"nome-da-zona": "#RRGGBB"}'}</code>. Depois de publicada, trocá-la quebra a
          integração dele.
        </p>
        {/* Sugestão visível, nunca conserto automático: quem confirma a chave é o time. */}
        {sugestao !== '' && sugestao !== zoneKey.trim() && (
          <p className="zona-form__ajuda">
            Sugestão a partir do nome: <code>{sugestao}</code>. Digite-a se concordar — o editor
            não troca a chave sozinho.
          </p>
        )}
        {erroDaChave !== null && (
          <p className="zona-form__erro" id="zona-form-zone-key-erro">
            {erroDaChave}
          </p>
        )}
      </div>

      <div className="zona-form__campo">
        <label className="zona-form__rotulo" htmlFor="zona-form-cor-default">
          Cor padrão (opcional)
        </label>
        <input
          id="zona-form-cor-default"
          name="cor_default"
          type="text"
          placeholder="#RRGGBB"
          value={corDefault}
          disabled={salvando}
          aria-invalid={erroDaCor !== null}
          aria-describedby={descrever('zona-form-cor-default', erroDaCor)}
          onChange={(evento) => props.aoMudarCorDefault(evento.target.value)}
        />
        <p className="zona-form__ajuda" id="zona-form-cor-default-ajuda">
          Hex (#RRGGBB). É a cor que a API usa quando o cliente não manda cor para esta zona.
          Deixe vazio para não ter cor padrão.
        </p>
        {erroDaCor !== null && (
          <p className="zona-form__erro" id="zona-form-cor-default-erro">
            {erroDaCor}
          </p>
        )}
      </div>

      {/* Botão cinza sem explicação vira chamado de suporte: o motivo fica escrito. */}
      {semElemento && (
        <p className="zona-form__ajuda">
          Para salvar, marque pelo menos um elemento no calçado — clique no desenho as partes que
          formam esta zona.
        </p>
      )}

      {/* A diferença entre UPDATE e INSERT precisa ser vista ANTES do clique. */}
      {zonaExistente && (
        <p className="zona-form__ajuda">
          Já existe uma zona com essa chave: salvar acrescenta os elementos marcados a ela, em vez
          de criar outra zona.
        </p>
      )}

      <div className="zona-form__acoes">
        <button type="submit" disabled={!podeSalvar}>
          {textoDoBotao(salvando, zonaExistente)}
        </button>
        {/* Desabilitado durante a gravação: cancelar no meio da escrita deixaria a tela
            afirmando um estado que o banco ainda não confirmou. */}
        <button type="button" disabled={salvando} onClick={props.aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Roda a validação do motor e devolve a mensagem para o campo. Só `ErroDeVariante` vira
 * texto: qualquer outra exceção sobe, porque esconder falha desconhecida num rótulo de
 * campo é exatamente o erro silencioso que o princípio nº1 proíbe.
 */
function mensagemDoMotor(validar: () => unknown): string | null {
  try {
    validar();
    return null;
  } catch (erro) {
    if (erro instanceof ErroDeVariante) return erro.message;
    throw erro;
  }
}

function descrever(campo: string, erro: string | null): string {
  return erro === null ? `${campo}-ajuda` : `${campo}-ajuda ${campo}-erro`;
}

function textoDoBotao(salvando: boolean, zonaExistente: boolean): string {
  if (salvando) return 'Salvando…';

  return zonaExistente ? 'Adicionar à zona existente' : 'Criar zona';
}
