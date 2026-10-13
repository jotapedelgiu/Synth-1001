// Lista (select) de padrões prontos. Padrões com `group` ficam num <optgroup>; os demais
// ficam soltos, na ordem em que aparecem. "Personalizado" é mostrado quando o usuário edita
// um passo (markCustom).
export function createPresetSelect(patterns, initialId, title) {
  const select = document.createElement('select');
  select.className = 'presets';
  select.title = title;

  const custom = new Option('Personalizado', '');
  custom.disabled = true;
  select.append(custom);

  const groups = new Map();
  for (const pattern of patterns) {
    const option = new Option(pattern.name, pattern.id);
    if (!pattern.group) {
      select.append(option);
      continue;
    }
    if (!groups.has(pattern.group)) {
      const group = document.createElement('optgroup');
      group.label = pattern.group;
      groups.set(pattern.group, group);
      select.append(group);
    }
    groups.get(pattern.group).append(option);
  }
  select.value = initialId;

  return { select, markCustom: () => { select.value = ''; } };
}
