import { portKind } from '../audio/Module.js';
import { saveModuleState } from '../ModuleStore.js';

const PORT_LABELS = { in: 'entrada', out: 'saída', freq: 'FM', gain: 'ganho', cutoff: 'corte', pitch: 'nota', gate: 'gate', clock: 'clock', return: 'retorno', send: 'envio', ch1: 'canal 1', ch2: 'canal 2', ch3: 'canal 3', ch4: 'canal 4' };

// Conector (jack) de uma porta. O CableLayer usa os data-attributes para achar o módulo/porta.
function createJack(module, port, dir) {
  const jack = document.createElement('div');
  const kind = portKind(module[dir === 'in' ? 'inputs' : 'outputs'][port]);
  jack.className = `jack jack-${dir} jack-${kind}`;
  jack.dataset.kind = kind;
  jack.dataset.module = module.id;
  jack.dataset.port = port;
  jack.dataset.dir = dir;
  const dot = document.createElement('span');
  dot.className = 'jack-dot';
  const label = document.createElement('span');
  label.className = 'jack-label';
  label.textContent = PORT_LABELS[port] ?? port;
  jack.append(dot, label);
  return jack;
}

function createJackGroup(module, dir) {
  const group = document.createElement('div');
  group.className = `jack-group jack-group-${dir}`;
  const ports = Object.keys(module[dir === 'in' ? 'inputs' : 'outputs']);
  for (const port of ports) group.appendChild(createJack(module, port, dir));
  return group;
}

// Painel de módulo. O sinal entra pelo canto superior esquerdo e sai pelo inferior direito:
//   título
//   ● entradas (esquerda)
//   body: os controles;  row: uma fileira de knobs já dentro do body
//   saídas ● (direita)
export function createPanel(title, module) {
  const element = document.createElement('div');
  element.className = 'panel';

  const titleEl = document.createElement('div');
  titleEl.className = 'panel-title';
  const titleText = document.createElement('span');
  titleText.className = 'panel-title-text';
  titleText.textContent = title;
  titleEl.appendChild(titleText);

  // Salvar: guarda os ajustes do módulo; na próxima visita ele abre assim
  if (module.getState()) {
    const save = document.createElement('button');
    save.className = 'save-button';
    save.textContent = 'Salvar';
    save.title = 'Salvar os ajustes deste módulo';
    let timer = null;
    save.addEventListener('click', () => {
      const ok = saveModuleState(module.id, module.getState());
      save.textContent = ok ? 'Salvo ✓' : 'Falhou';
      clearTimeout(timer);
      timer = setTimeout(() => { save.textContent = 'Salvar'; }, 1200);
    });
    titleEl.appendChild(save);
  }

  const body = document.createElement('div');
  body.className = 'panel-body';
  const row = document.createElement('div');
  row.className = 'knob-row';
  body.appendChild(row);

  element.append(titleEl, createJackGroup(module, 'in'), body, createJackGroup(module, 'out'));
  return { element, body, row };
}
