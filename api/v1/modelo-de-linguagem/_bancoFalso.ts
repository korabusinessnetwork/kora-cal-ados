// O banco falso dos testes dos quatro handlers de `modelo-de-linguagem/`. Sem rede e sem Postgres.
//
// Mora num arquivo só porque os quatro handlers precisam do mesmo cenário (duas marcas, duas
// pessoas, configuração gravada, uso do mês), e quatro cópias divergiriam: bastaria uma delas parar
// de aplicar o filtro de tenant para o teste daquele handler passar a aprovar vazamento entre marcas.
//
// Ele FILTRA de verdade pelos `.eq`, `.gte` e `.lt` recebidos, no molde de `_variants.test.ts`. Um
// falso que devolvesse as linhas ignorando os filtros deixaria o teste da marca concorrente verde
// mesmo sem isolamento nenhum, que é o defeito que ele existe para pegar.
//
// Começa com `_` para a Vercel não tratar o arquivo como rota (`api/README.md`).

import type { SupabaseClient } from '@supabase/supabase-js';

export type Linha = Record<string, unknown>;

export interface Observado {
  tabelas: string[];
  campos: string[];
  filtros: Array<[string, string, unknown]>;
  inseridas: Linha[];
  apagou: string[];
}

interface Filtro {
  operador: 'eq' | 'gte' | 'lt';
  coluna: string;
  valor: unknown;
}

export function bancoFalso(tabelas: Record<string, Linha[]>, usuariosPorToken: Record<string, string>) {
  const observado: Observado = { tabelas: [], campos: [], filtros: [], inseridas: [], apagou: [] };

  function consultar(tabela: string, filtros: Filtro[], ordem: { coluna: string; crescente: boolean } | null, teto: number | null) {
    let linhas = (tabelas[tabela] ?? []).filter((linha) =>
      filtros.every(({ operador, coluna, valor }) => {
        const atual = linha[coluna];
        if (operador === 'eq') return atual === valor;
        if (operador === 'gte') return String(atual) >= String(valor);
        return String(atual) < String(valor);
      }),
    );
    if (ordem) {
      linhas = [...linhas].sort((a, b) => String(a[ordem.coluna]).localeCompare(String(b[ordem.coluna])));
      if (!ordem.crescente) linhas.reverse();
    }
    return teto === null ? linhas : linhas.slice(0, teto);
  }

  function construtor(tabela: string, campos: string, contarSemLinhas: boolean) {
    const filtros: Filtro[] = [];
    let ordem: { coluna: string; crescente: boolean } | null = null;
    let teto: number | null = null;

    const recortar = (linha: Linha) =>
      Object.fromEntries(campos.split(',').map((campo) => campo.trim()).map((campo) => [campo, linha[campo]]));

    const resultado = () => {
      const linhas = consultar(tabela, filtros, ordem, teto);
      return contarSemLinhas ? { count: linhas.length, error: null } : { data: linhas.map(recortar), error: null };
    };

    const construido = {
      eq(coluna: string, valor: unknown) {
        filtros.push({ operador: 'eq', coluna, valor });
        observado.filtros.push(['eq', coluna, valor]);
        return construido;
      },
      gte(coluna: string, valor: unknown) {
        filtros.push({ operador: 'gte', coluna, valor });
        return construido;
      },
      lt(coluna: string, valor: unknown) {
        filtros.push({ operador: 'lt', coluna, valor });
        return construido;
      },
      order(coluna: string, opcoes?: { ascending?: boolean }) {
        ordem = { coluna, crescente: opcoes?.ascending !== false };
        return construido;
      },
      limit(quantidade: number) {
        teto = quantidade;
        return construido;
      },
      maybeSingle() {
        const linhas = consultar(tabela, filtros, ordem, teto);
        return Promise.resolve({ data: linhas[0] ? recortar(linhas[0]) : null, error: null });
      },
      // Thenable: o código de produção aguarda a consulta em pontos diferentes da cadeia
      // (`.gte(...)` na contagem, `.limit(...)` na listagem), e um falso que só respondesse no fim
      // obrigaria o teste a conhecer a ordem das chamadas.
      then(aoResolver: (valor: unknown) => unknown) {
        return Promise.resolve(resultado()).then(aoResolver);
      },
    };

    return construido;
  }

  const cliente = {
    auth: {
      getUser(token: string) {
        const usuario = usuariosPorToken[token];
        return Promise.resolve(
          usuario === undefined
            ? { data: { user: null }, error: { message: 'invalid token' } }
            : { data: { user: { id: usuario } }, error: null },
        );
      },
    },
    from(tabela: string) {
      observado.tabelas.push(tabela);
      return {
        select(campos: string, opcoes?: { count?: string; head?: boolean }) {
          observado.campos.push(campos);
          return construtor(tabela, campos, opcoes?.head === true);
        },
        insert(linha: Linha) {
          observado.inseridas.push({ ...linha, __tabela: tabela });
          (tabelas[tabela] ??= []).push({ ...linha, created_at: linha.created_at ?? new Date().toISOString() });
          return Promise.resolve({ error: null });
        },
        upsert(linha: Linha) {
          // Como o Postgres: o `not null` vale para a linha a inserir mesmo quando há conflito.
          if (tabela === 'tenant_modelos_de_linguagem' && (linha.chave_cifrada === undefined || linha.chave_cifrada === null)) {
            return Promise.resolve({ error: { message: 'null value in column "chave_cifrada" violates not-null constraint' } });
          }
          const lista = (tabelas[tabela] ??= []);
          const existente = lista.find((atual) => atual.tenant_id === linha.tenant_id);
          if (existente) Object.assign(existente, linha);
          else lista.push({ ...linha });
          return Promise.resolve({ error: null });
        },
        update(campos: Linha) {
          return {
            eq(coluna: string, valor: unknown) {
              const existente = (tabelas[tabela] ?? []).find((linha) => linha[coluna] === valor);
              if (existente) Object.assign(existente, campos);
              return Promise.resolve({ error: null });
            },
          };
        },
        delete() {
          return {
            eq(coluna: string, valor: unknown) {
              observado.apagou.push(tabela);
              const lista = tabelas[tabela] ?? [];
              const indice = lista.findIndex((linha) => linha[coluna] === valor);
              if (indice >= 0) lista.splice(indice, 1);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, tabelas, observado };
}
