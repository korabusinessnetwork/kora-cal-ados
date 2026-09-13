// A porta de entrada do ADR-008: descrever o calçado e ver o que o modelo de linguagem compôs (T09c).
//
// Irmão do `PainelDeColar`, e com a mesma regra central: o que o modelo respondeu só sobe para a tela
// depois de passar pelo guarda, e uma recusa não encosta no calçado que está em cena. A diferença é
// que aqui existe espera, porque um modelo de verdade é rede.
//
// Quem responde entra por parâmetro, junto com a descrição dele, para a mesma tela servir ao gerador
// de prova de hoje e ao fornecedor que o dono escolher (D12), sem a frase de ajuda mentir em nenhum
// dos dois casos.

import { useEffect, useRef, useState } from 'react';

import {
  TAMANHO_MAXIMO_DO_PROMPT,
  gerarComposicaoPorPrompt,
  type ModeloDeLinguagem,
} from '../lib/composicao/gerarComposicaoPorPrompt';
import type { CatalogoDoAcervo, Forma } from '../lib/composicao/tiposDaComposicao';
import { escolhasDaComposicao, mensagemDe, type EscolhaDaTela } from './composicaoDaTela';
import { quemRespondeOPrompt, type DescricaoDoModelo } from './textosDoPrompt';

/** O desfecho do último pedido. `null` é "ainda não pediu", e não anuncia nada na abertura. */
type Desfecho = { tipo: 'gerando' } | { tipo: 'recusado'; motivo: string } | { tipo: 'gerado' };

interface PainelDePromptProps {
  forma: Forma;
  catalogo: CatalogoDoAcervo;
  modelo: ModeloDeLinguagem;
  descricao: DescricaoDoModelo;
  /**
   * O calçado em cena ainda é o que o último prompt compôs. Quando a pessoa mexe à mão, a frase
   * "o calçado na tela agora é o que o prompt compôs" deixa de ser verdade e some.
   */
  geradoEmCena: boolean;
  /** Só é chamado com uma composição que passou pelo guarda. */
  aoGerar: (escolhas: Map<string, EscolhaDaTela>) => void;
}

export function PainelDePrompt({ forma, catalogo, modelo, descricao, geradoEmCena, aoGerar }: PainelDePromptProps) {
  const [prompt, setPrompt] = useState('');
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  // Um modelo de verdade pode responder depois de a pessoa sair da tela. Escrever estado num
  // componente desmontado não quebra nada hoje, mas subir escolhas para uma tela que não existe mais
  // quebraria, e a guarda é a mesma.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const gerando = desfecho?.tipo === 'gerando';

  async function gerar() {
    setDesfecho({ tipo: 'gerando' });

    try {
      const composicao = await gerarComposicaoPorPrompt(prompt, forma, catalogo, modelo);
      if (!montado.current) return;

      setDesfecho({ tipo: 'gerado' });
      aoGerar(escolhasDaComposicao(composicao));
    } catch (erro) {
      if (!montado.current) return;

      setDesfecho({ tipo: 'recusado', motivo: mensagemDe(erro) });
    }
  }

  return (
    <div className="palco3d__entrada palco3d__prompt">
      <label className="palco3d__entrada-rotulo" htmlFor="composicao-prompt">
        Descrever o calçado
      </label>
      <textarea
        id="composicao-prompt"
        className="palco3d__entrada-texto palco3d__prompt-texto"
        rows={3}
        maxLength={TAMANHO_MAXIMO_DO_PROMPT}
        placeholder="Descreva o calçado em uma ou duas frases."
        value={prompt}
        onChange={(evento) => setPrompt(evento.target.value)}
      />
      {/* Desabilitado com o campo vazio: prevenção vale mais que a mensagem de "descreva o calçado",
          que continua existindo no módulo para quem chamar sem a tela. Desabilitado também enquanto
          gera, que é o que impede dois pedidos disputando qual calçado fica em cena. */}
      <button
        type="button"
        className="palco3d__copiar"
        disabled={gerando || prompt.trim() === ''}
        onClick={() => void gerar()}
      >
        {gerando ? 'Gerando…' : 'Gerar composição'}
      </button>
      {/* Texto fixo, fora de região viva, pela mesma razão da ajuda do painel de colar. */}
      <p className="palco3d__saida-ajuda">{quemRespondeOPrompt(descricao)}</p>
      {/* UMA região viva para o desfecho, com o `role` escolhido pelo desfecho (A55): recusa
          interrompe, porque o calçado em cena não é o que foi pedido; espera e aceite esperam a vez. */}
      {desfecho !== null &&
        !(desfecho.tipo === 'gerado' && !geradoEmCena) &&
        (desfecho.tipo === 'recusado' ? (
          <p className="palco3d__saida-erro" role="alert" aria-atomic="true">
            {desfecho.motivo} O calçado na tela continua sendo o de antes.
          </p>
        ) : (
          <p className="palco3d__saida-ok" role="status" aria-atomic="true">
            {desfecho.tipo === 'gerando'
              ? 'Gerando a composição…'
              : 'Composição gerada. O calçado na tela agora é o que o prompt compôs.'}
          </p>
        ))}
    </div>
  );
}
