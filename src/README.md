# src, a raiz do que roda no navegador

Quatro telas, sem roteador. Qual delas abre sai de `?tela=` na URL, e a regra inteira mora em
[`telaInicial.ts`](telaInicial.ts), fora do componente, porque "qual tela abre sem sessão" é
decisão de segurança, e decisão de segurança escondida num `if` no meio de um componente é a que
ninguém revisa.

| Arquivo | O que faz |
|---|---|
| `main.tsx` | Ponto de entrada. Monta o `App` e importa TODO o CSS, uma vez, para nenhum componente importar estilo (regra de white-label do `CLAUDE.md`) |
| `App.tsx` | Decide qual tela está aberta, cuida do título da aba e do endereço, e envolve cada tela numa `RedeDeProtecao` |
| `RedeDeProtecao.tsx` | O `ErrorBoundary` do projeto. Exceção de render deixa de apagar a página inteira |
| `RodapeDeTelas.tsx` | O rodapé de navegação entre as telas. Componente burro: quem decide o que ele mostra é `saidasDaTela.ts` |
| `saidasDaTela.ts` | Para onde cada tela leva e com que palavras. Puro, com teste |
| `telaInicial.ts` | `?tela=` vira tela, tela vira endereço, tela vira título de aba. Puro, com teste |

## As quatro telas, e de que lado do portão cada uma fica

- [`esboco/`](esboco/) `?tela=esboco`, o editor 2D sobre um SVG commitado. **Sem banco, sem conta.**
- [`palco3d/`](palco3d/) `?tela=palco3d` e `?tela=composicao`, uma peça por vez e o calçado
  montado. **Sem banco, sem conta**: as peças vêm de [`lib/acervo/`](lib/acervo/), que é código.
- [`features/`](features/) o editor de zonas logado, atrás de `RotaProtegida`. É a única área que
  fala com o Supabase, e a única que exige `.env.local`.

Essa divisão é o que faz um clone recém-baixado abrir em `?tela=esboco` sem conta nenhuma, e está
escrita assim de propósito: cobrar credencial de quem não vai usar credencial é a "prevenção de
erro" do princípio nº1 aplicada ao contrário.

## O que NÃO mora aqui

- **Regra de negócio**, que fica em [`lib/`](lib/). O motor de recolor é o mesmo do editor e da
  API, e é isso que sustenta "cor no editor = cor na API".
- **Nada que use `service_role`.** A chave de serviço nunca entra no front, e existe varredura
  reprovando em `npm test` se alguém a trouxer (`lib/supabase/`).

Os diretórios `components/`, `constants/`, `context/`, `hooks/`, `pages/`, `styles/` e `utils/`
podem aparecer vazios numa cópia de trabalho antiga: são sobra de andaime, **não estão
versionados**, e um clone não os tem. Componente novo mora na pasta da tela ou da feature a que
ele pertence, nunca num `components/` genérico (ADR-003).
