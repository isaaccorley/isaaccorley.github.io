"use client";

import Essentia from "essentia.js/dist/essentia.js-core.es.js";
import { AcousticIndices, calculateAcousticIndices } from "./acoustic-indices";
import { calculateFrequencyBands, FrequencyBandEnergies } from "./frequency-bands";

let essentiaInstance: Essentia | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmReadyPromise: Promise<any> | null = null;

export async function preloadEssentia(): Promise<void> {
  await getEssentiaInstance();
}

async function getEssentiaInstance(): Promise<Essentia> {
  if (!essentiaInstance) {
    if (!wasmReadyPromise) {
      wasmReadyPromise = import("essentia.js/dist/essentia-wasm.web.js").then(async (module) => {
        const wasmModuleFactory = module.default || module;

        if (typeof wasmModuleFactory !== "function") {
          throw new Error("EssentiaWASM module is not a function. Expected a factory function.");
        }

        const wasmModule = wasmModuleFactory({
          locateFile: (path: string, prefix?: string) => {
            if (path.endsWith(".wasm")) {
              return "/essentia-wasm/essentia-wasm.web.wasm";
            }
            return prefix ? prefix + path : path;
          },
          INITIAL_MEMORY: 256 * 1024 * 1024, // 256MB in bytes
        });

        if (wasmModule.ready && typeof wasmModule.ready.then === "function") {
          const readyModule = await wasmModule.ready;
          return readyModule;
        } else if (wasmModule.EssentiaJS && typeof wasmModule.EssentiaJS === "function") {
          return wasmModule;
        } else {
          return wasmModule;
        }
      });
    }

    const wasmModule = await wasmReadyPromise;

    if (!wasmModule) {
      throw new Error("EssentiaWASM module failed to load.");
    }

    if (!wasmModule.EssentiaJS || typeof wasmModule.EssentiaJS !== "function") {
      console.error("WASM Module structure:", {
        hasEssentiaJS: !!wasmModule.EssentiaJS,
        typeOfEssentiaJS: typeof wasmModule.EssentiaJS,
        hasReady: !!wasmModule.ready,
        keys: Object.keys(wasmModule).slice(0, 20),
      });
      throw new Error(
        "EssentiaWASM module is not properly initialized. EssentiaJS is not available. " +
          "The WASM module may not have finished loading. Please try again.",
      );
    }

    essentiaInstance = new Essentia(wasmModule);
  }
  return essentiaInstance;
}

export interface SpectrogramOptions {
  width?: number;
  height?: number;
  sampleRate?: number;
  duration?: number;
  dynamicRange?: number;
}

export interface SpectrogramResult {
  imageData: ImageData;
  acousticIndices: AcousticIndices;
  frequencyBands: FrequencyBandEnergies;
}

export interface SpectrogramsResult {
  spectrograms: ImageData[];
  acousticIndices: AcousticIndices[];
  frequencyBands: FrequencyBandEnergies[];
}

const DEFAULT_OPTIONS: Required<SpectrogramOptions> = {
  width: 1000,
  height: 257,
  sampleRate: 8000,
  duration: 12,
  dynamicRange: 90,
};

export async function audioFileToSpectrograms(
  file: File,
  options: SpectrogramOptions = {},
  onProgress?: (current: number, total: number) => void,
): Promise<SpectrogramsResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const audioContext = new AudioContext({ sampleRate: opts.sampleRate });

  try {
    const arrayBuffer = await file.arrayBuffer();

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeError) {
      const fileName = file.name.toLowerCase();
      const supportedFormats = ["wav", "mp3", "ogg", "m4a", "mp4", "aac", "flac"];
      const fileExtension = fileName.split(".").pop() || "";

      if (!supportedFormats.includes(fileExtension)) {
        throw new Error(
          `Unsupported audio format: .${fileExtension}. ` +
            `Supported formats: ${supportedFormats.join(", ")}. ` +
            `Your browser may also have limited support for some formats.`,
        );
      }

      throw new Error(
        `Failed to decode audio file. The file may be corrupted, ` +
          `in an unsupported codec, or your browser doesn't support this format. ` +
          `Error: ${decodeError instanceof Error ? decodeError.message : "Unknown error"}`,
      );
    }

    return await audioBufferToSpectrograms(audioBuffer, opts, onProgress);
  } finally {
    await audioContext.close();
  }
}

export async function audioFileToSpectrogram(
  file: File,
  options: SpectrogramOptions = {},
): Promise<SpectrogramResult> {
  const result = await audioFileToSpectrograms(file, options);
  return {
    imageData: result.spectrograms[0] ?? new ImageData(1000, 257),
    acousticIndices: result.acousticIndices[0] ?? { aci: 0, adi: 0, ndsi: 0, bi: 0 },
    frequencyBands: result.frequencyBands[0] ?? { geophony: 0, anthrophony: 0, biophony: 0 },
  };
}

export async function audioBufferToSpectrograms(
  audioBuffer: AudioBuffer,
  options: Required<SpectrogramOptions>,
  onProgress?: (current: number, total: number) => void,
): Promise<SpectrogramsResult> {
  const { sampleRate, duration } = options;

  const totalDuration = audioBuffer.duration;
  const clipDuration = duration;
  if (totalDuration < clipDuration) {
    throw new Error(`Audio must be at least ${clipDuration} seconds.`);
  }
  const numClips = Math.ceil(totalDuration / clipDuration);

  const channelData = audioBuffer.getChannelData(0);
  let monoData: Float32Array;

  if (audioBuffer.numberOfChannels === 1) {
    monoData = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      monoData[i] = channelData[i];
    }
  } else {
    const channel1 = audioBuffer.getChannelData(0);
    const channel2 = audioBuffer.getChannelData(1);
    monoData = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      monoData[i] = (channel1[i] + channel2[i]) / 2;
    }
  }

  let processedData = monoData;
  if (audioBuffer.sampleRate !== sampleRate) {
    processedData = await resampleToTargetRate(monoData, audioBuffer.sampleRate, sampleRate);
  }

  const spectrograms: ImageData[] = [];
  const acousticIndices: AcousticIndices[] = [];
  const frequencyBands: FrequencyBandEnergies[] = [];
  const samplesPerClip = Math.floor(clipDuration * sampleRate);

  // Calculate max frequency (Nyquist frequency)
  const maxFrequency = sampleRate / 2;

  if (onProgress) {
    onProgress(0, numClips);
  }

  for (let clipIdx = 0; clipIdx < numClips; clipIdx++) {
    const startSample = clipIdx * samplesPerClip;
    const endSample = Math.min(startSample + samplesPerClip, processedData.length);
    const clipData = processedData.slice(startSample, endSample);

    if (clipData.length > 0) {
      const clipOptions = { ...options };
      if (onProgress) {
        onProgress(clipIdx, numClips);
      }

      const spectrogram = await generateSpectrogram(clipData, clipOptions);
      spectrograms.push(spectrogram);

      // Calculate acoustic indices and frequency bands
      const indices = calculateAcousticIndices(spectrogram, maxFrequency);
      const bands = calculateFrequencyBands(spectrogram, maxFrequency);

      acousticIndices.push(indices);
      frequencyBands.push(bands);

      if (onProgress) {
        onProgress(clipIdx + 1, numClips);
      }
    }
  }

  return {
    spectrograms,
    acousticIndices,
    frequencyBands,
  };
}

export async function audioBufferToSpectrogram(
  audioBuffer: AudioBuffer,
  options: Required<SpectrogramOptions>,
): Promise<SpectrogramResult> {
  const result = await audioBufferToSpectrograms(audioBuffer, options);
  return {
    imageData: result.spectrograms[0] ?? new ImageData(1000, 257),
    acousticIndices: result.acousticIndices[0] ?? { aci: 0, adi: 0, ndsi: 0, bi: 0 },
    frequencyBands: result.frequencyBands[0] ?? { geophony: 0, anthrophony: 0, biophony: 0 },
  };
}

async function resampleToTargetRate(
  data: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number,
): Promise<Float32Array> {
  if (originalSampleRate === targetSampleRate) {
    return data;
  }
  const durationSeconds = data.length / originalSampleRate;
  const targetLength = Math.ceil(durationSeconds * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const buffer = offlineCtx.createBuffer(1, data.length, originalSampleRate);
  buffer.copyToChannel(new Float32Array(data), 0);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  const out = rendered.getChannelData(0);
  const copy = new Float32Array(out.length);
  copy.set(out);
  return copy;
}

async function generateSpectrogram(
  audioData: Float32Array,
  options: Required<SpectrogramOptions>,
): Promise<ImageData> {
  const { width, height, dynamicRange } = options;

  const essentia = await getEssentiaInstance();

  const fftSize = (height - 1) * 2;
  const hopLength = Math.floor(audioData.length / width);
  const windowSize = fftSize;

  const spectrogram = new Uint8ClampedArray(width * height * 4);

  for (let x = 0; x < width; x++) {
    const start = x * hopLength;
    const end = Math.min(start + windowSize, audioData.length);

    const frameArray = new Float32Array(windowSize);
    const copyLength = Math.min(windowSize, end - start);

    for (let i = 0; i < copyLength; i++) {
      frameArray[i] = audioData[start + i];
    }

    const frameVector = essentia.arrayToVector(frameArray);

    const windowedResult = essentia.Windowing(frameVector, true, windowSize, "hamming", 0, true);

    if (!windowedResult || !windowedResult.frame) {
      throw new Error("Windowing failed. Result: " + JSON.stringify(windowedResult));
    }

    const spectrumResult = essentia.Spectrum(windowedResult.frame);

    type SpectrumResult = { spectrum?: unknown; magnitude?: unknown };
    const spectrumTyped = spectrumResult as SpectrumResult;
    const spectrumVector = (spectrumTyped.spectrum ??
      spectrumTyped.magnitude ??
      spectrumResult) as unknown;

    if (!spectrumVector) {
      throw new Error("Spectrum failed. Result: " + JSON.stringify(spectrumResult));
    }
    const magnitude = essentia.vectorToArray(spectrumVector);
    const numBins = magnitude.length;

    for (let y = 0; y < height; y++) {
      const freqIdx = Math.floor((y / height) * numBins);
      const mag = freqIdx < numBins ? magnitude[freqIdx] : 0;

      const power = mag;
      const db = 20 * Math.log10(power + 1e-10);
      const normalized = Math.max(0, Math.min(1, (db + dynamicRange) / dynamicRange));
      const pixelValue = Math.floor(normalized * 255);

      const idx = (height - 1 - y) * width + x;
      const base = idx * 4;
      spectrogram[base] = pixelValue;
      spectrogram[base + 1] = pixelValue;
      spectrogram[base + 2] = pixelValue;
      spectrogram[base + 3] = 255;
    }
  }

  return new ImageData(spectrogram, width, height);
}
