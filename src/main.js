import { FFT_SIZE, Synth } from './audio/Synth.js';
import { MODULE_TYPES } from './audio/moduleTypes.js';
import { ScopeView } from './scope/ScopeView.js';
import { Trigger } from './scope/Trigger.js';
import { CableLayer } from './ui/CableLayer.js';
import { ContextMenu } from './ui/ContextMenu.js';
import { Hud } from './ui/Hud.js';
import { Workspace } from './ui/Workspace.js';
import { restoreModule } from './ModuleStore.js';
import { createModulePanel } from './ui/modulePanels.js';

const POINTS = 2048;
const HUD_HEIGHT = 56; // faixa da barra superior

// Posição inicial dos módulos do patch padrão: o sinal flui da esquerda para a direita e, em
// escada, de cima para baixo (fontes no canto superior esquerdo, saídas no inferior direito).
// `title` troca o título padrão do painel.
const DEFAULT_NODES = {
  seq: { x: 0, y: 0 },
  mic: { x: 0, y: 400 },
  osc1: { x: 400, y: 0, title: 'Onda 1' },
  osc2: { x: 400, y: 240, title: 'Onda 2' },
  mixer: { x: 740, y: 170 },
  filter: { x: 880, y: 230 },
  env: { x: 1150, y: 290 },
  drums: { x: 1150, y: 640 },
  delay: { x: 1540, y: 350 },
  speaker: { x: 1790, y: 380 },
  scope: { x: 1790, y: 480 },
};

// O AudioContext nasce suspenso (sem gesto do usuário) e é liberado no clique em "Ativar áudio"
const ctx = new AudioContext();
const synth = new Synth(ctx);
let started = false;

// --- Interface ----------------------------------------------------------
const workspace = new Workspace(document.body, { storageKey: 'osciloscope.layout.v1', topInset: HUD_HEIGHT });
const menu = new ContextMenu();

const hud = new Hud({
  onStart: async () => {
    await ctx.resume();
    started = true;
    refresh();
  },
  onZoom: (factor) => workspace.zoomBy(factor),
  onFit: () => workspace.fit(),
  onReset: () => workspace.resetLayout(),
});

function refresh() {
  hud.render({ started, status: synth.statusText() });
}
synth.patch.onChange(refresh);

// --- Módulos na área de trabalho ----------------------------------------
const scopes = new Map(); // id do osciloscópio → ScopeView

// Cria o painel do módulo, coloca na área de trabalho e, se for um osciloscópio, liga a tela dele
function mountModule(module, home, { title, restore = true } = {}) {
  restoreModule(module);
  const panel = createModulePanel(module, { title, refresh, tempo: synth.tempo });
  workspace.addNode(module.id, panel.element, home, { restore });
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
  mountModule(module, home, { title, restore: false });
}

function removeModule(id) {
  scopes.get(id)?.dispose();
  scopes.delete(id);
  workspace.removeNode(id);
  synth.remove(id);
}

for (const module of synth.patch.modules) {
  const { x, y, title } = DEFAULT_NODES[module.id] ?? { x: 0, y: 0 };
  mountModule(module, { x, y }, { title });
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

// Espaço = gate de todos os envelopes ligados
function envelopes() {
  return synth.patch.modules.filter((m) => m.moduleType === 'envelope' && m.enabled);
}
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
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
