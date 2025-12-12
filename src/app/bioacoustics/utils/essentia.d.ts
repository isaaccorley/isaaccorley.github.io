/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'essentia.js' {
  export default class Essentia {
    constructor(wasm: any);
    arrayToVector(inputArray: Float32Array): any;
    vectorToArray(inputVector: any): Float32Array;
    Windowing(
      frame: any,
      normalized: boolean,
      size: number,
      type: string,
      zeroPhase: number,
      normalizedWindow: boolean
    ): { frame: any };
    Spectrum(frame: any): { magnitude: any };
  }
}

declare module 'essentia.js/dist/essentia-wasm.web.js' {
  const EssentiaWASM: any;
  export default EssentiaWASM;
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  export default class Essentia {
    constructor(wasm: any);
    arrayToVector(inputArray: Float32Array): any;
    vectorToArray(inputVector: any): Float32Array;
    Windowing(
      frame: any,
      normalized: boolean,
      size: number,
      type: string,
      zeroPhase: number,
      normalizedWindow: boolean
    ): { frame: any };
    Spectrum(frame: any): { magnitude: any };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

