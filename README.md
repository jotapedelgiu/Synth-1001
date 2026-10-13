# Osciloscope

Osciloscópio em three.js (Vite).

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

## Estrutura

- `index.html` — página base
- `src/main.js` — ponto de entrada: cria o Synth, a tela e a interface e liga tudo
- `src/audio/Module.js` — classe base dos módulos (portas `inputs`/`outputs`, `connect`)
- `src/audio/modules/` — Gain, Oscillator, ChordOscillator, Filter, Envelope, Delay, Sequencer, DrumMachine, Speaker, Microphone, Scope
- `src/audio/Tempo.js` — BPM compartilhado (sequenciador, delay sincronizado, batidas da bateria)
- `src/audio/moduleTypes.js` — catálogo dos módulos que podem ser adicionados (menu do botão direito)
- `src/audio/Patch.js` — módulos nomeados + cabos (cada cabo é um `connect()` real; recusa duplicados e ciclos; `remove` desfaz os cabos e libera o módulo)
- `src/audio/patterns.js` — ritmos prontos do sequenciador (16 passos, BPM e gate sugeridos)
- `src/audio/EventPorts.js` — portas de evento (`gate` e `clock`): carregam mensagens com o instante exato, no relógio do áudio
- `src/audio/drumPatterns.js` — batidas prontas da bateria
- `src/audio/drumKits.js` — kits de sons da bateria (sintetizado e gravações)
- `public/samples/` — amostras dos kits e `LICENSES.md` com créditos e licenças
- `src/audio/Synth.js` — cria os módulos e o patch inicial
- `src/scope/ScopeView.js` — three.js: cena 2D e traço, desenhados dentro da tela do painel do osciloscópio
- `src/scope/Trigger.js` — leitura do buffer, trigger, janela e fase
- `src/ui/ContextMenu.js` — menu do botão direito
- `src/ui/modulePanels.js` — escolhe o painel de cada tipo de módulo
- `src/ui/Workspace.js` — área de trabalho infinita: zoom, pan e nós arrastáveis (salva o layout no navegador)
- `src/ui/` — Knob, painéis dos módulos (com jacks), `CableLayer` (cabos arrastáveis em SVG) e barra superior (Hud)
- `src/style.css` — estilos

## Patch

Arraste de um jack de **saída** (bolinha cheia) até um de **entrada** (bolinha vazia) para criar um cabo. Arrastar de uma entrada já ligada pega o cabo de volta; clicar num cabo o remove.

Cabos tracejados são de evento: âmbar = **gate**, azul = **clock**; os demais são de áudio/controle. Só portas do mesmo tipo se ligam.

## Área de trabalho

Os módulos são **nós** numa área infinita, como no editor de materiais da Unreal:

- **Roda do mouse:** zoom em direção ao cursor (ou os botões − / + na barra superior).
- **Arrastar o fundo** (botão esquerdo, do meio ou direito): move a vista.
- **Arrastar um módulo** por qualquer parte que não seja um controle: move o nó. Os cabos acompanham.
- **Ajustar** enquadra todos os módulos na tela; **Reorganizar** devolve cada um à posição original.
- **Botão direito** (clique sem arrastar) no fundo: lista os módulos que podem ser **adicionados** (Oscilador, Acordes, Sequenciador, Bateria, Microfone, Filtro, Envelope, Delay, Mixer, Alto-falante, Osciloscópio), no ponto clicado. Sobre um módulo: **Remover módulo**. Arrastar com o botão direito continua movendo a vista.
- Posições e zoom são lembrados entre as visitas (localStorage). Os módulos adicionados e os cabos **não** são salvos: ao recarregar volta o patch padrão.

Posição inicial: o sinal flui da esquerda para a direita e, em escada, de cima para baixo (fontes no canto superior esquerdo, saídas no inferior direito). Os valores iniciais estão em `src/main.js` (`nodes`). Em cada módulo, as **entradas** ficam no canto superior esquerdo e as **saídas** no inferior direito.

## Kits de bateria

O painel da bateria tem um seletor de **kit de sons**: *Sintetizada* (gerada no código), *Roland TR-808* (gravações reais de Michael Fischer) e *Rock acústica* (GMRockKit do Hydrogen, GPL v3+). As gravações são baixadas na primeira vez que o kit é escolhido. Créditos e licenças em `public/samples/LICENSES.md`. Abra a página com `?debug` para acessar o `synth` no console.
