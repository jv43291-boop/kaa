# Kaá · Lendas da Floresta

RPG de ação na floresta amazônica. Você é Kauã, aprendiz da Vó Jaci: desperte os três
totens (Onça, Arara e Jabuti) e purifique o Boitatá, a serpente de fogo corrompida pela
Névoa Roxa.

**Jogar e instalar:** https://joaomagalhaes321.github.io/kaa/

Tudo é gerado por código, sem imagens prontas: terreno, vegetação, personagens, luz
dinâmica, ciclo de dia e noite, chuva e a trilha sonora. Depois da primeira visita o jogo
funciona offline.

## Instalar no celular

- **Android (Chrome):** abra o link e toque em *Instalar no celular* no menu do jogo, ou
  em ⋮ → *Instalar app*.
- **iPhone (Safari):** *Compartilhar* → *Adicionar à Tela de Início*.

## Controles

- **Celular:** polegar esquerdo anda; botões à direita atacam, esquivam, curam e usam
  habilidades.
- **Teclado:** WASD/setas, `J` ou Espaço ataca, `K` ou Shift esquiva, `1` `2` `3`
  habilidades, `Q` cuia de ervas, `E` conversar/purificar, `Esc` pausa.
- Controle de videogame também funciona.

## Estrutura

- `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`: o jogo publicado (PWA).
- `fonte/`: código-fonte separado por módulos. Para gerar uma nova versão, edite
  `fonte/src/` e rode `python3 fonte/build.py`; os arquivos saem em `fonte/dist/pwa/`
  e vão para a raiz do repositório.
