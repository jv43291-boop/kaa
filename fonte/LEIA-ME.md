# Kaá · Lendas da Floresta

RPG de ação feito em HTML5 Canvas, sem engine e sem imagens externas: terreno, árvores,
personagens, luz e trilha sonora são gerados por código. Funciona offline depois da
primeira abertura e pode ser instalado no celular como app (PWA).

## Como colocar no celular

O app precisa estar hospedado em HTTPS para o celular oferecer a instalação.
Qualquer hospedagem de arquivos estáticos serve. Suba **o conteúdo desta pasta** (o
`index.html` precisa ficar na raiz do endereço ou de uma subpasta).

- **GitHub Pages**: crie um repositório, envie estes arquivos e ative Pages em
  *Settings → Pages* (branch `main`, pasta `/root`).
- **Dokploy / Nginx / qualquer servidor estático**: sirva a pasta como site estático.
- **Netlify Drop**: arraste a pasta em app.netlify.com/drop.

Depois, no celular:

- **Android (Chrome)**: abra o endereço, toque em *Instalar no celular* no menu do jogo
  ou em ⋮ → *Instalar app*.
- **iPhone (Safari)**: *Compartilhar* → *Adicionar à Tela de Início*.

O jogo abre em tela cheia, na horizontal, com ícone próprio.

## Quer um APK para a Play Store?

Com o jogo já hospedado, cole o endereço em pwabuilder.com e gere o pacote Android
(TWA). Ele usa este mesmo PWA por baixo.

## Arquivos

- `index.html`: o jogo inteiro (código, estilos e arte procedural)
- `manifest.webmanifest`: nome, ícones e orientação do app
- `sw.js`: service worker que guarda o jogo para rodar offline
- `icons/`: ícones do app

## Controles

- Celular: polegar esquerdo anda; botões à direita atacam, esquivam e usam habilidades.
- Teclado: WASD/setas, J ou Espaço (ataque), K ou Shift (esquiva), 1/2/3 (habilidades),
  Q (cuia de ervas), E (conversar/purificar), Esc (pausa).
- Controle de videogame também funciona.

O progresso fica salvo no próprio aparelho.
