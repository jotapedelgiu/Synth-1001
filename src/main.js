import { FFT_SIZE, Synth } from './audio/Synth.js';
import { MODULE_TYPES } from './audio/moduleTypes.js';
import { ScopeView } from './scope/ScopeView.js';
import { Trigger } from './scope/Trigger.js';
import { CableLayer } from './ui/CableLayer.js';
import { ContextMenu } from './ui/ContextMenu.js';
import { Hud } from './ui/Hud.js';
import { Workspace } from './ui/Workspace.js';
import { loadScene, saveScene } from './SceneStore.js';
import { createModulePanel } from './ui/modulePanels.js';

const POINTS = 2048;
const HUD_HEIGHT = 56; // faixa da barra superior

// Posição inicial dos módulos do patch padrão: o sinal flui da esquerda para a direita e, em
// escada, de cima para baixo (fontes no canto superior esquerdo, saídas no inferior direito).
// `title` troca o título padrão do painel.
const DEFAULT_NODES = {
  seq: { x: 0, y: 0 },
  mixer: { x: 460, y: 0 },
  speaker: { x: 1200, y: 0 },
};

// O AudioContext nasce suspenso (sem gesto do usuário) e é liberado no clique em "Ativar áudio"
const ctx = new AudioContext();
const synth = new Synth(ctx);
let started = false;

// --- Interface ----------------------------------------------------------
const workspace = new Workspace(document.body, { storageKey: 'osciloscope.layout.v1', topInset: HUD_HEIGHT });
const menu = new ContextMenu();

const hud = new Hud({
  onStart: () => toggleAudio(),
  onZoom: (factor) => workspace.zoomBy(factor),
  onFit: () => workspace.fit(),
  onReset: () => workspace.resetLayout(),
  onSave: () => saveScene(currentScene()),
  onBpm: (bpm) => { synth.tempo.bpm = bpm; },
});

function refresh() {
  hud.render({ started, paused: ctx.state !== 'running', status: synth.statusText() });
}
ctx.addEventListener('statechange', refresh);

// Primeira vez ativa o áudio (precisa de um gesto do usuário); depois alterna pausa/play
async function toggleAudio() {
  if (!started) started = true;
  else if (ctx.state === 'running') return ctx.suspend();
  await ctx.resume();
}
synth.patch.onChange(refresh);
synth.tempo.onChange((bpm) => hud.setBpm(bpm));
hud.setBpm(synth.tempo.bpm);

// --- Módulos na área de trabalho ----------------------------------------
const scopes = new Map(); // id do osciloscópio → ScopeView

// Cria o painel do módulo, coloca na área de trabalho e, se for um osciloscópio, liga a tela dele
function mountModule(module, home, { title, state = null } = {}) {
  if (state) restoreState(module, state);
  const panel = createModulePanel(module, { title, refresh, tempo: synth.tempo });
  workspace.addNode(module.id, panel.element, home, { restore: false });
  if (panel.screen) mountScope(module, panel.screen);
}

function mountScope(module, screen) {
  const view = new ScopeView(screen, POINTS);
  const trigger = new Trigger({ fftSize: FFT_SIZE, points: POINTS });
  view.setDetail(workspace.zoom);
  view.setTrace(new Float32Array(POINTS)); // linha reta até o áudio iniciar
  view.run(() => {
    if (started) view.setTrace(trigger.read(module, synth.triggerSettings(module.id)));
  });
  scopes.set(module.id, view);
}

function addModule(type, home) {
  const { module, title } = synth.add(type);
  mountModule(module, home, { title });
}

// Recoloca nos controles do módulo o que foi salvo (antes de criar o painel, que lê esses valores)
function restoreState(module, state) {
  try {
    module.setState(state);
    module.restored = true;
  } catch (err) {
    console.warn(`Estado salvo de "${module.id}" ignorado:`, err);
  }
}

// --- Cena (o projeto inteiro) ---------------------------------------------
function currentScene() {
  return {
    modules: synth.patch.modules.map((module) => ({
      id: module.id,
      type: module.moduleType,
      title: document.querySelector(`[data-node="${module.id}"] .panel-title-text`)?.textContent,
      state: module.getState(),
      ...workspace.position(module.id),
    })),
    bpm: synth.tempo.bpm,
    cables: synth.patch.cables.map(({ from, to }) => ({ from: { ...from }, to: { ...to } })),
  };
}

// Troca o patch padrão pelo salvo. Roda antes de qualquer painel existir.
function buildFromScene(scene) {
  for (const module of synth.patch.modules) synth.remove(module.id);
  for (const saved of scene.modules) {
    try {
      const { module, title } = synth.add(saved.type, saved.id);
      mountModule(module, { x: saved.x ?? 0, y: saved.y ?? 0 }, { title: saved.title ?? title, state: saved.state });
    } catch (err) {
      console.warn(`Módulo "${saved.id}" ignorado:`, err);
    }
  }
  // cenas antigas guardavam o BPM dentro do sequenciador
  const bpm = scene.bpm ?? scene.modules.find((m) => m.type === 'sequencer')?.state?.bpm;
  if (bpm) synth.tempo.bpm = bpm;
  for (const { from, to } of scene.cables) synth.patch.connect(from.module, from.port, to.module, to.port);
}

function removeModule(id) {
  scopes.get(id)?.dispose();
  scopes.delete(id);
  workspace.removeNode(id);
  synth.remove(id);
}

const savedScene = loadScene();
if (savedScene) {
  buildFromScene(savedScene);
} else {
  for (const module of synth.patch.modules) {
    const { x, y, title } = DEFAULT_NODES[module.id] ?? { x: 0, y: 0 };
    mountModule(module, { x, y }, { title });
  }
}

const cables = new CableLayer(synth.patch, workspace.world, () => workspace.zoom);

// Mover, dar zoom ou redimensionar um nó: redesenha os cabos e ajusta a nitidez das telas
workspace.onChange(() => {
  cables.render();
  for (const view of scopes.values()) view.setDetail(workspace.zoom);
  hud.setZoom(workspace.zoom);
});
if (!workspace.restored) workspace.fit();
window.addEventListener('resize', () => cables.render());

// --- Menu do botão direito -----------------------------------------------
// No fundo: lista os módulos que podem ser adicionados, agrupados. Sobre um módulo: remover.
workspace.onContextMenu(({ x, y, nodeId }) => {
  if (nodeId) {
    const title = document.querySelector(`[data-node="${nodeId}"] .panel-title-text`)?.textContent ?? nodeId;
    menu.show(x, y, [{ header: title }, { label: 'Remover módulo', onSelect: () => removeModule(nodeId) }]);
    return;
  }
  const home = workspace.screenToWorld(x, y);
  const entries = [];
  let group = null;
  for (const def of MODULE_TYPES) {
    if (def.group !== group) {
      group = def.group;
      entries.push({ header: group });
    }
    entries.push({ label: def.label, onSelect: () => addModule(def.type, home) });
  }
  menu.show(x, y, [{ header: 'Adicionar módulo' }, ...entries]);
});

// Espaço = play/stop dos sequenciadores (a bateria segue o clock deles). Se o áudio ainda estiver
// desligado ou pausado, só o religa e já começa a tocar.
function sequencers() {
  return synth.patch.modules.filter((m) => m.moduleType === 'sequencer');
}
window.addEventListener('keydown', async (e) => {
  if (e.code !== 'Space' || e.shiftKey) return;
  if (e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]')) return;
  e.preventDefault(); // evita que o espaço "clique" no botão que estiver com foco
  if (e.repeat) return;
  started = true; // a tecla já é um gesto do usuário, então também serve para ativar o áudio
  if (ctx.state !== 'running') await ctx.resume();
  const all = sequencers();
  const playing = all.some((s) => s.playing);
  for (const seq of all) {
    if (playing) seq.stop();
    else seq.play();
  }
  refresh();
});
window.addEventListener('keyup', (e) => {
  // o clique em botões com foco dispara no keyup; bloqueia para o espaço ser só pausa/play
  if (e.code === 'Space' && !e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]')) e.preventDefault();
});

// Shift+Espaço = gate de todos os envelopes ligados
function envelopes() {
  return synth.patch.modules.filter((m) => m.moduleType === 'envelope' && m.enabled);
}
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !e.shiftKey) return;
  const active = envelopes();
  if (!active.length) return;
  e.preventDefault();
  if (!e.repeat) for (const envelope of active) envelope.noteOn();
});
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return;
  const active = envelopes();
  if (!active.length) return;
  e.preventDefault();
  for (const envelope of active) envelope.noteOff();
});

// Para depurar no console do navegador: abra a página com ?debug e use `synth` e `workspace`
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { synth, workspace, menu });

refresh();
