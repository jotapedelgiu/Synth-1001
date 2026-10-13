// Tipo de uma porta: 'audio' (AudioNode/AudioParam) ou 'gate' (evento). Só portas do mesmo tipo se ligam.
export function portKind(port) {
  return port?.kind ?? 'audio';
}

// Base de todo módulo de áudio. Um módulo expõe portas nomeadas:
//   inputs.<nome>  -> AudioNode ou AudioParam que recebe sinal
//   outputs.<nome> -> AudioNode que emite sinal
// Ligar dois módulos é só ligar uma porta de saída a uma de entrada (um "cabo").
export class Module {
  // Identificador do tipo de módulo (cada subclasse define o seu): a interface usa para escolher o painel
  static type = 'module';

  constructor(ctx) {
    this.ctx = ctx;
    this.inputs = {};
    this.outputs = {};
  }

  // (não se chama `type` porque módulos como o Filtro já têm uma propriedade com esse nome)
  get moduleType() {
    return this.constructor.type;
  }

  // Estado que o botão Salvar guarda (JSON) e como recolocá-lo. `null` = nada a salvar.
  getState() {
    return null;
  }

  setState() {}

  // Libera o que o módulo mantém ligado (osciladores, timers, microfone...) quando ele é
  // removido do patch. Os cabos já foram desfeitos pelo Patch.
  dispose() {}

  // Posição do relógio de áudio que está sendo OUVIDA agora. `currentTime` é o que o
  // navegador está processando; o som sai pelo alto-falante um pouco depois (latência da
  // saída), então a interface usa este valor para acompanhar o que se escuta.
  audibleTime() {
    return this.ctx.currentTime - (this.ctx.baseLatency ?? 0) - (this.ctx.outputLatency ?? 0);
  }

  // Aceita outro Module (usa a porta de entrada `inPort`) ou um AudioNode/AudioParam cru.
  // Retorna o destino, permitindo encadear: a.connect(b).connect(c)
  connect(target, outPort = 'out', inPort = 'in') {
    this.outputs[outPort].connect(this.#resolve(target, inPort));
    return target;
  }

  disconnect(target, outPort = 'out', inPort = 'in') {
    this.outputs[outPort].disconnect(this.#resolve(target, inPort));
  }

  #resolve(target, inPort) {
    return target instanceof Module ? target.inputs[inPort] : target;
  }
}
