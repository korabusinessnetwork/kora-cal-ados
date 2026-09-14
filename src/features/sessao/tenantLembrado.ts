// Qual tenant o usuário escolheu da última vez, por usuário.
//
// Existe para que recarregar a página não faça quem trabalha em duas marcas escolher de
// novo a cada F5. Guardado por `user_id` porque a mesma máquina pode ser usada por duas
// pessoas, herdar a escolha de outra abriria a marca errada.
//
// O valor é só uma PREFERÊNCIA de interface: quem decide o que esse tenant pode ver é a
// RLS. Adulterar o localStorage não dá acesso a nada; o contexto ainda confere se o id
// está na lista que o banco devolveu.

const PREFIXO = 'kora.tenant-ativo.';

export function tenantLembrado(userId: string): string | null {
  try {
    return window.localStorage.getItem(PREFIXO + userId);
  } catch {
    // Modo privativo/cookies bloqueados fazem localStorage lançar. Perder a preferência
    // é aceitável; derrubar o login por causa disso não é.
    return null;
  }
}

export function lembrarTenantAtivo(userId: string, tenantId: string): void {
  try {
    window.localStorage.setItem(PREFIXO + userId, tenantId);
  } catch {
    /* preferência é descartável, ver acima */
  }
}
