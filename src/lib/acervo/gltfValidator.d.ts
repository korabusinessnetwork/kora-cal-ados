// Tipos para o validador de referência da Khronos, que é compilado de Dart e não traz `.d.ts`.
//
// Só o que os testes usam. Declarar o pacote inteiro seria copiar um contrato que não é nosso e
// que envelheceria em silêncio; declarar de menos faz o typecheck avisar na hora em que
// precisarmos de mais.
//
// O pacote é devDependency e só é importado de arquivo `.test.ts`, então ele nunca entra no
// bundle do navegador nem na função serverless.

declare module 'gltf-validator' {
  /** 0 é Erro, 1 é Aviso, 2 é Informação, 3 é Dica. A escala é do validador, não nossa. */
  export interface MensagemDoValidador {
    code: string;
    message: string;
    severity: number;
    pointer?: string;
  }

  export interface RelatorioDoValidador {
    issues: {
      numErrors: number;
      numWarnings: number;
      numInfos: number;
      numHints: number;
      messages: MensagemDoValidador[];
    };
  }

  export function validateBytes(
    bytes: Uint8Array,
    opcoes?: {
      /** Chamado quando o arquivo aponta para fora. As peças de prova nunca apontam. */
      externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
      maxIssues?: number;
    },
  ): Promise<RelatorioDoValidador>;
}
