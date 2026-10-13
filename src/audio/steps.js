// Tamanho dos padrões: um compasso tem 16 passos (semicolcheias) e o sequenciador e a bateria
// tocam dois compassos (32 passos) antes de repetir.
export const BAR_STEPS = 16;
export const STEPS = 2 * BAR_STEPS;

// Aceita a lista de um compasso (é repetida) ou de dois compassos. Qualquer outro tamanho é erro.
export function fitBars(list, what = 'Padrão') {
  if (list.length === BAR_STEPS) return [...list, ...list];
  if (list.length === STEPS) return [...list];
  throw new Error(`${what} tem ${list.length} passos (esperado ${BAR_STEPS} ou ${STEPS})`);
}
