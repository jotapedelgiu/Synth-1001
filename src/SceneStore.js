const KEY = 'osciloscope.scene.v1';

// A "cena" é o projeto inteiro: módulos (tipo, título, ajustes, posição) e os cabos entre eles.
//   { modules: [{ id, type, title, state, x, y }], cables: [{ from: { module, port }, to: { module, port } }] }

// Salva a cena no navegador. Retorna false se não foi possível.
export function saveScene(scene) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scene));
    return true;
  } catch {
    return false; // armazenamento indisponível ou cheio
  }
}

// A cena salva, ou null se não há nenhuma (ou se está inválida)
export function loadScene() {
  try {
    const scene = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(scene?.modules) && Array.isArray(scene?.cables) ? scene : null;
  } catch {
    return null;
  }
}
