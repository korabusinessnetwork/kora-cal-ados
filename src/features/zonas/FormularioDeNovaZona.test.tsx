// O que este formulário precisa provar não é "renderiza": é que estado inválido NÃO chega
// ao banco e que a pessoa lê o motivo na tela. Cada teste abaixo protege uma regra em que
// errar custa caro — `zone_key` é contrato público da API, e cor errada vira calçado
// fabricado errado (princípio nº1 do CLAUDE.md).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormularioDeNovaZona } from './FormularioDeNovaZona';

const formulario = (props: Partial<Parameters<typeof FormularioDeNovaZona>[0]> = {}) =>
  renderToStaticMarkup(
    <FormularioDeNovaZona
      rotulo=""
      zoneKey="sola"
      corDefault=""
      quantidadeMarcada={3}
      zonaExistente={false}
      salvando={false}
      erro={null}
      confirmacao={null}
      aoMudarRotulo={() => {}}
      aoMudarZoneKey={() => {}}
      aoMudarCorDefault={() => {}}
      aoSalvar={() => {}}
      aoCancelar={() => {}}
      {...props}
    />,
  );

/** O botão de salvar isolado, para afirmar `disabled` sem depender do resto do HTML. */
function botaoSalvar(html: string): string {
  const trecho = /<button type="submit"[^>]*>.*?<\/button>/s.exec(html)?.[0];

  if (trecho === undefined) throw new Error('botão de salvar não encontrado no HTML');

  return trecho;
}

describe('formulário de nova zona', () => {
  it('com tudo válido, o salvar está habilitado', () => {
    expect(botaoSalvar(formulario())).not.toContain('disabled');
  });

  it('sem elemento marcado desabilita o salvar E escreve o motivo', () => {
    // Botão cinza sem explicação é o defeito: a pessoa não descobre sozinha que falta
    // clicar no desenho.
    const html = formulario({ quantidadeMarcada: 0 });

    expect(botaoSalvar(html)).toContain('disabled');
    expect(html).toContain('marque pelo menos um elemento no calçado');
  });

  it.each(['Cadarço', 'zona sola', '2-sola'])(
    'chave inválida (%s) mostra a mensagem do motor, desabilita o salvar e não corrige o campo',
    (chave) => {
      // A mensagem vem de `validarZoneKey`; o formulário não reimplementa a regra de slug.
      const html = formulario({ zoneKey: chave });

      expect(html).toContain('minúscula, sem acento e sem espaço');
      expect(botaoSalvar(html)).toContain('disabled');
      // Conserto silencioso é proibido: a chave é contrato com o cliente, quem confirma
      // é o time.
      expect(html).toContain(`value="${chave}"`);
    },
  );

  it('chave vazia é recusada com a mensagem do motor', () => {
    const html = formulario({ zoneKey: '' });

    expect(html).toContain('A zona precisa de uma chave (zone_key)');
    expect(botaoSalvar(html)).toContain('disabled');
  });

  it('cor inválida mostra a mensagem do motor, desabilita o salvar e não corrige o campo', () => {
    const html = formulario({ corDefault: 'vermelho' });

    expect(html).toContain('não é um hex válido');
    expect(botaoSalvar(html)).toContain('disabled');
    expect(html).toContain('value="vermelho"');
  });

  it('cor vazia é ausência de cor padrão, não erro', () => {
    // `cor_default` é opcional na tabela: exigir cor aqui inventaria uma regra que o
    // banco não tem.
    const html = formulario({ corDefault: '' });

    expect(html).not.toContain('hex válido (esperado');
    expect(botaoSalvar(html)).not.toContain('disabled');
  });

  it('sugere a chave a partir do rótulo digitado, sem preencher o campo', () => {
    const html = formulario({ rotulo: 'Cadarço lateral', zoneKey: '' });

    expect(html).toContain('cadarco-lateral');
    expect(html).toContain('Sugestão a partir do nome');
    expect(html).toContain('value=""');
  });

  it('não repete a sugestão quando a chave já é a sugerida', () => {
    const html = formulario({ rotulo: 'Cadarço lateral', zoneKey: 'cadarco-lateral' });

    expect(html).not.toContain('Sugestão a partir do nome');
  });

  it('diz que a chave é o que o cliente manda no JSON da API', () => {
    expect(formulario()).toContain('no JSON da API');
  });

  it('zona existente muda o texto do botão para acréscimo — UPDATE, não INSERT', () => {
    // A diferença entre "acrescenta elementos" e "cria outra zona" precisa ser vista
    // antes do clique: `unique (product_id, zone_key)` não perdoa depois.
    const nova = formulario({ zonaExistente: false });
    const existente = formulario({ zonaExistente: true });

    expect(nova).toContain('Criar zona');
    expect(existente).toContain('Adicionar à zona existente');
    expect(existente).not.toContain('Criar zona');
    expect(existente).toContain('acrescenta os elementos marcados');
  });

  it('salvando desabilita o salvar e anuncia o que está acontecendo', () => {
    const html = formulario({ salvando: true });

    expect(botaoSalvar(html)).toContain('disabled');
    expect(html).toContain('Salvando…');
    expect(html).toContain('aria-busy="true"');
  });

  it('erro do banco aparece como alerta com o texto recebido', () => {
    const html = formulario({ erro: 'Essa zona já foi marcada — recarregue.' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Essa zona já foi marcada');
  });

  it('mostra a contagem de elementos marcados no singular e no plural', () => {
    expect(formulario({ quantidadeMarcada: 1 })).toContain('1 elemento marcado');
    expect(formulario({ quantidadeMarcada: 4 })).toContain('4 elementos marcados');
    expect(formulario({ quantidadeMarcada: 1 })).not.toContain('1 elementos');
  });

  it('todo campo tem rótulo ligado por htmlFor/id', () => {
    const html = formulario();

    for (const campo of ['zona-form-rotulo', 'zona-form-zone-key', 'zona-form-cor-default']) {
      expect(html).toContain(`for="${campo}"`);
      expect(html).toContain(`id="${campo}"`);
    }
  });

  it('não renderiza nome de marca — o produto é white-label', () => {
    // Identidade vem do tenant; nome de cliente no JSX vaza um tenant para outro.
    const html = formulario({ rotulo: 'Cadarço lateral', erro: 'x', quantidadeMarcada: 0 });

    expect(html).not.toMatch(/kora|aurora|calçados aurora|runner/i);
  });

  // A confirmação existe porque gravar não dizia que gravou: é o único dos quatro estados
  // obrigatórios do CLAUDE.md que faltava nesta tela (R2-A18).
  it('a confirmação aparece como região de status, não como alerta', () => {
    const html = formulario({ confirmacao: 'Zona "sola" criada com 3 elementos.' });

    expect(html).toContain('role="status"');
    expect(html).toContain('Zona &quot;sola&quot; criada com 3 elementos.');
  });

  it('sem confirmação, nenhuma região de status é renderizada', () => {
    expect(formulario()).not.toContain('role="status"');
  });
});
