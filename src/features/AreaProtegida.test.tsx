// @vitest-environment jsdom
//
// A metade da área protegida que dá para montar sem rede: a tela de "falta `.env.local`".
//
// Por que só ela: o outro caminho cria o cliente Supabase de verdade na primeira chamada e sai
// procurando sessão. Montá-lo aqui seria montar uma tela que depende de rede e de credencial, e um
// teste assim ou vira `vi.mock` de biblioteca inteira, que este projeto não usa em lugar nenhum, ou
// vira um teste que passa por acidente. Metade dita por inteiro vale mais que uma inteira mentida.
//
// O que esta metade prende é o que o R6-A52 mexeu de verdade: a conferência da configuração mudou
// de arquivo, e a tela dela deixou de desenhar o próprio rodapé, porque agora o rodapé vem do
// `App.tsx`, fora da rede de proteção, como nas outras três telas. Sem este teste, a conferência
// poderia ter sumido na mudança de casa e o sintoma só apareceria numa máquina sem `.env.local`,
// que é justamente a máquina de quem está configurando o projeto pela primeira vez.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AreaProtegida } from './AreaProtegida';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  raiz = createRoot(container);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function montar(ambiente: Record<string, string | undefined>) {
  act(() => {
    raiz.render(<AreaProtegida ambiente={ambiente} />);
  });
}

describe('a área protegida sem `.env.local` (A52)', () => {
  it('diz o que falta, e diz as DUAS variáveis de uma vez', () => {
    montar({});

    expect(container.querySelector('h1')?.textContent).toBe('Configuração do Supabase ausente');
    const texto = container.textContent ?? '';
    // Reportar uma variável de cada vez faria quem está configurando descobrir o problema em duas
    // rodadas de tentativa e erro. A regra é de `configuracaoDoSupabase.ts`, e o que se prende aqui
    // é que a TELA mostra a mensagem inteira em vez de resumi-la.
    expect(texto).toContain('Faltam variáveis de ambiente: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.');
    expect(texto).toContain('.env.local');
    // E que ela diz qual chave vai ali, que é o aviso mais caro da mensagem. O nome da chave
    // PROIBIDA não é escrito aqui de propósito: `semServiceRoleNoFront.test.ts` varre `src/`
    // inteiro atrás desse termo, e a lista de isentos dela é uma lista de segurança. Alargá-la para
    // caber uma asserção de texto seria pagar com a guarda cara uma conferência barata, que a
    // mensagem já tem em `lib/supabase/configuracaoDoSupabase.test.ts`, do lado isento.
    expect(texto).toContain('anon/publishable');
  });

  it('falta só uma, e a LISTA fala só dela', () => {
    // Contraprova da anterior, e ela nasceu de uma mutação que sobreviveu: a primeira versão deste
    // teste só procurava os dois nomes soltos no texto, e trocar `{problema}` por uma frase fixa no
    // JSX passava nos três testes. Os dois nomes aparecem SEMPRE na mensagem, porque a instrução
    // final diz o que escrever no `.env.local`. O que muda com o ambiente é só a lista do começo, e
    // é ela que tem de ser afirmada.
    montar({ VITE_SUPABASE_URL: 'https://exemplo.supabase.co' });

    const texto = container.textContent ?? '';
    expect(texto).toContain('Faltam variáveis de ambiente: VITE_SUPABASE_ANON_KEY.');
    expect(texto).not.toContain('Faltam variáveis de ambiente: VITE_SUPABASE_URL');
  });

  it('a tela do aviso NÃO desenha rodapé próprio', () => {
    // O rodapé vem do `App.tsx`, fora da rede de proteção, como nas outras três telas. Antes do
    // R6-A52 ele era desenhado aqui dentro, e manter os dois deixaria a mesma lista de destinos
    // duas vezes na tela, que foi exatamente o defeito achado no navegador no R6-A51.
    montar({});

    expect(container.querySelector('.rodape-telas')).toBe(null);
  });
});
