# Isolamento Multi-Tenant, Kora Calçados (codinome)

> Adaptado de `references/seguranca.md` da skill `fundacao-de-projeto`, com ênfase no
> risco específico deste produto: **marcas concorrentes dividindo o mesmo sistema**.

## Por que este é o risco #1 do produto (não genérico)

Diferente da maioria dos SaaS B2B, aqui o vazamento entre tenants não é só um problema
de dado pessoal, é **vazamento de coleção não lançada** de uma marca calçadista para
uma concorrente direta que também é cliente da plataforma. O dano é competitivo, não só
regulatório. Isolamento entre tenants é, portanto, requisito de produto e de confiança
comercial, não só item de checklist técnico.

## Modelo de ameaças

| Camada | Ameaça principal | Controle obrigatório |
|--------|------------------|----------------------|
| Cliente/UI | `service_role` vazada no front, XSS | Só chave `anon` no front; nunca `service_role` no client |
| Rede/API | Endpoint de variante aceita `product_id` de outro tenant | Toda função valida o `tenant_id` **da credencial** contra o `tenant_id` do produto antes de qualquer leitura/escrita. Produto de outro tenant responde **404**, não 403, 403 confirma que o id existe |
| Rede/API | Chave de API vaza (log, URL, repositório do cliente) | Chave só em header `Authorization`, **nunca** em query string; guardada em hash (o banco não tem como devolvê-la); log registra só o prefixo; revogável sem derrubar as outras chaves da marca (ADR-006) |
| Rede/API | A função de variante roda com `service_role` e **bypassa a RLS** | O `tenant_id` sai **sempre** da chave, nunca do corpo/URL/header do chamador, e a validação mora num módulo único por onde toda rota passa. Este é o **único** ponto do sistema em que o isolamento não é do Postgres (ADR-006, D3) |
| Autorização | Um tenant lê zona/produto de outro | **RLS em toda tabela**, política por `tenant_id`; testar isolamento antes de cada release |
| Storage | SVG base de um tenant acessível via URL previsível | Path particionado por tenant (`tenants/{tenant_id}/products/{id}/...`), bucket privado, URL assinada com expiração curta |
| Observabilidade | Log cruza nome de modelo/cliente entre tenants | Logs de erro nunca incluem payload completo de outro tenant; scrub antes de gravar |

## Controles obrigatórios (checklist de release)

### Segredos e configuração
- [ ] Nenhuma chave/URL/secret hardcodada, tudo via `import.meta.env.VITE_*`
- [ ] `.env*` no `.gitignore`
- [ ] `service_role` jamais exposta ao cliente ou usada em função sem checagem de tenant

### Autenticação e autorização
- [ ] Auth verificada antes de renderizar rota protegida
- [ ] RLS ativa em **todas** as tabelas (`tenants`, `products`, `product_zones`,
      `variants`) antes de qualquer deploy além de local
- [ ] Teste de isolamento: usuário do tenant A tenta acessar `product_id` do tenant B
      via API, deve falhar sempre, incluindo por manipulação direta de ID na URL
- [ ] Toda função de geração de variante resolve o `tenant_id` a partir da **credencial**
      nunca confia em `tenant_id` vindo do corpo da requisição. Desde o ADR-006 a
      credencial da API é a **chave de API do tenant**, não o token de usuário: o editor e
      a API autenticam por caminhos diferentes e nenhuma credencial serve para os dois

### Entrada e dados
- [ ] Input de zona/cor validado por schema antes de tocar no SVG (evita injeção via
      atributo malformado)
- [ ] Upload de SVG base validado (tipo, tamanho, sem `<script>` embutido) antes de
      aceitar no Storage
- [ ] Sem `select *` em tabelas, sempre campos explícitos

### Logging e observabilidade
- [ ] Log de erro nunca inclui o SVG completo de outro produto/tenant
- [ ] Log de atividade fire-and-forget, nunca bloqueia a geração de variante

## Compliance

Produto é B2B puro nesta fase (sem consumidor final, sem PII sensível de terceiros).
O requisito de compliance relevante aqui não é setor regulado (não é fiscal, não é
PCI), é confidencialidade comercial entre tenants, tratada como requisito de
segurança de primeira classe, não como LGPD genérico. Ainda assim:

- Dado pessoal tratado (nome, e-mail, empresa dos usuários do time cliente) segue
  princípio de minimização, só o necessário pra login e contato.
- Direito de exportar/excluir dados previsto no roadmap (Fase 3, junto com self-serve).

## Resposta a incidentes (mínimo viável)

1. **Detectar**, de onde veio (log, report de cliente). Registrar em `memory/bugs.md`
   com severidade, vazamento entre tenants é sempre severidade CRÍTICA.
2. **Conter**, revogar chave/sessão, isolar o tenant afetado, confirmar escopo do
   vazamento (quais produtos, quais zonas).
3. **Corrigir**, patch + teste de isolamento que prova a correção (o mesmo teste
   deve rodar em CI daí em diante).
4. **Registrar**, post-mortem em `memory/learnings.md`; se muda arquitetura/política,
   abrir ADR.
5. **Notificar**, cliente afetado é avisado. Isolamento é a promessa central do
   produto; um incidente não comunicado destrói a confiança comercial mais rápido
   que o incidente em si.

## Custo

Todos os controles acima usam tiers gratuitos (RLS do Supabase, storage privado com
URL assinada, `npm audit`, secret scanning do GitHub). Nenhum depende de serviço pago
na Fase 1. Ver `memory/restrictions.md`.
