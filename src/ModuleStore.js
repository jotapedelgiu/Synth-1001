const KEY = 'osciloscope.modules.v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

// Salva o estado de um módulo (pelo id dele) no navegador. Retorna false se não foi possível.
export function saveModuleState(id, state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: state }));
    return true;
  } catch {
    return false; // armazenamento indisponível ou cheio
  }
}

// Recoloca no módulo o que foi salvo para o id dele, se houver. Chamado antes de criar o painel,
// para os controles já abrirem nos valores salvos.
export function restoreModule(module) {
  const state = read()[module.id];
  if (!state || typeof state !== 'object') return;
  try {
    module.setState(state);
    module.restored = true;
  } catch (err) {
    console.warn(`Estado salvo de "${module.id}" ignorado:`, err);
  }
}
