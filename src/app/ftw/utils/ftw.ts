"use client";

/**
 * Client-side utilities for running ONNX models in the browser.
 * Uses onnxruntime-web for browser-based inference.
 */

import type { InferenceSession, Tensor } from "onnxruntime-web";
import { upsamplePatch } from "./common";
import type { ModelOption } from "./model-loader";
import { MODEL_OPTIONS } from "./model-loader";

// Try to suppress ONNX Runtime warnings early
try {
  // Set environment variables before importing ONNX Runtime
  if (typeof window !== "undefined") {
    // This might help suppress warnings in the browser
    (window as unknown as Record<string, unknown>).ORT_LOG_LEVEL = 3; // Error level only
  }
} catch {
  // Ignore if not available
}

type OrtModule = typeof import("onnxruntime-web");

let ortModulePromise: Promise<OrtModule> | null = null;

const getOrtModule = (): Promise<OrtModule> => {
  if (!ortModulePromise) {
    ortModulePromise = (async () => {
      const ort = await import("onnxruntime-web");

      // Try multiple approaches to suppress warnings
      try {
        // Method 1: Set log level
        if (ort.env && typeof ort.env.logLevel !== "undefined") {
          ort.env.logLevel = "error";
        }

        // Method 2: Set log severity level
        if (ort.env && typeof ort.env.logSeverityLevel !== "undefined") {
          ort.env.logSeverityLevel = 3; // Error level only
        }

        // Method 3: Try to set verbose level
        if (ort.env && typeof ort.env.verbose !== "undefined") {
          ort.env.verbose = false;
        }
      } catch (e) {
        // Ignore if log level settings are not available
        console.warn("Could not set ONNX Runtime log level:", e);
      }

      return ort;
    })();
  }
  return ortModulePromise;
};

export interface FieldOnnxModelOptions {
  /**
   * URL or ArrayBuffer of the ONNX model to load.
   */
  modelPath: string | ArrayBuffer;
  /**
   * Optional execution providers to try, in order of preference.
   * Defaults to ['webgpu', 'webgl', 'wasm'].
   */
  executionProviders?: string[];
  /**
   * Optional log severity level (0=verbose, 1=info, 2=warning, 3=error, 4=fatal).
   * Defaults to 2 (warnings and errors only).
   */
  logSeverityLevel?: number;
}

export interface FieldOnnxInferenceInput {
  /**
   * Flattened Float32 pixel data in RGBN order (4 channels).
   */
  data: Float32Array;
  /**
   * Width of the raster (pixels).
   */
  width: number;
  /**
   * Height of the raster (pixels).
   */
  height: number;
  /**
   * Optional divisor used to normalise reflectance values (defaults to 4000).
   */
  normalization?: number;
  /**
   * If true, the tensor will be converted from NHWC to NCHW (default true).
   */
  nchw?: boolean;
}

export interface FieldOnnxModelResult {
  session: InferenceSession;
  outputs: Record<string, Tensor>;
}

// Try WebGPU first, then WebGL, then WASM as fallback
// Some operations will always run on CPU for performance reasons
const DEFAULT_EXECUTION_PROVIDERS = ["webgpu", "webgl", "wasm"];

const loadModelSession = async (options: FieldOnnxModelOptions): Promise<InferenceSession> => {
  const ort = await getOrtModule();

  const sessionOptions = {
    executionProviders: options.executionProviders ?? DEFAULT_EXECUTION_PROVIDERS,
    logSeverityLevel: (options.logSeverityLevel ?? 3) as 0 | 1 | 2 | 3 | 4,
    // Enable memory optimizations
    enableCpuMemArena: true,
    enableMemPattern: true,
  };

  // Handle both string URLs and ArrayBuffer model data
  let session: InferenceSession;
  if (typeof options.modelPath === "string") {
    console.log("Creating ONNX session from URL:", options.modelPath);
    session = await ort.InferenceSession.create(options.modelPath, sessionOptions);
  } else {
    console.log("Creating ONNX session from ArrayBuffer, size:", options.modelPath.byteLength);
    session = await ort.InferenceSession.create(new Uint8Array(options.modelPath), sessionOptions);
  }

  return session;
};

const normalisePixelData = (
  input: Float32Array,
  width: number,
  height: number,
  normalization: number,
): Float32Array => {
  const inv = normalization > 0 ? 1 / normalization : 1 / 4000;
  const length = width * height * 4;
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const value = input[i] * inv;
    output[i] = Math.min(Math.max(value, 0), 1);
  }
  return output;
};

const nhwcToNchw = (
  input: Float32Array,
  width: number,
  height: number,
  channels = 4,
): Float32Array => {
  const output = new Float32Array(channels * height * width);
  let dstIndex = 0;
  for (let c = 0; c < channels; c += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const srcIndex = (y * width + x) * channels + c;
        output[dstIndex] = input[srcIndex];
        dstIndex += 1;
      }
    }
  }
  return output;
};

export const createFieldOnnxSession = loadModelSession;

export const runFieldOnnxInference = async (
  session: InferenceSession,
  input: FieldOnnxInferenceInput,
): Promise<FieldOnnxModelResult> => {
  const ort = await getOrtModule();

  // Validate session
  if (!session) {
    throw new Error("ONNX session is null or undefined. Session creation may have failed.");
  }

  if (input.data.length !== input.width * input.height * 4) {
    throw new Error(
      `Expected RGBN data length ${input.width * input.height * 4}, received ${input.data.length}`,
    );
  }

  const normalizationDivisor =
    input.normalization && input.normalization > 0 ? input.normalization : 4000;

  const normalised = normalisePixelData(
    input.data,
    input.width,
    input.height,
    normalizationDivisor,
  );

  const tensorData =
    input.nchw === false ? normalised : nhwcToNchw(normalised, input.width, input.height);

  const tensorShape =
    input.nchw === false ? [1, input.height, input.width, 4] : [1, 4, input.height, input.width];

  if (!session.inputNames || session.inputNames.length === 0) {
    throw new Error("ONNX session has no input names. Session may not be properly initialized.");
  }

  const feeds: Record<string, Tensor> = {};
  const inputName = session.inputNames[0];

  // For now, use float32 for all models to avoid data type conversion issues
  // Many ONNX models can accept float32 input even if they're FP16 models
  const dataType = "float32";
  feeds[inputName] = new ort.Tensor(dataType, tensorData, tensorShape);

  const outputs = await session.run(feeds);
  return {
    session,
    outputs,
  };
};

export interface OnnxSegmentationResult {
  mask: number[];
  width: number;
  height: number;
  classes: string[];
  classCounts: number[];
  confidences: number[];
}

export const runSegmentationInference = async (
  session: InferenceSession,
  input: FieldOnnxInferenceInput,
  classes: string[],
  scoreThreshold: number = 0.5,
): Promise<OnnxSegmentationResult> => {
  const result = await runFieldOnnxInference(session, input);

  const outputNames = session.outputNames ?? Object.keys(result.outputs);
  const firstOutputName = outputNames[0];
  const tensor = result.outputs[firstOutputName];

  if (!tensor) {
    throw new Error("ONNX model inference returned no outputs.");
  }

  if (!tensor.dims || tensor.dims.length < 3) {
    throw new Error(`Unexpected output tensor shape: ${tensor.dims}`);
  }

  const [batch, channels, outHeight, outWidth] =
    tensor.dims.length === 4 ? tensor.dims : [1, tensor.dims[0], tensor.dims[1], tensor.dims[2]];

  if (batch !== 1) {
    throw new Error(`Expected batch size 1, received ${batch}`);
  }

  const values = tensor.data as Float32Array | Float64Array | number[];
  const numPixels = outHeight * outWidth;
  const mask = new Uint8Array(numPixels);
  const counts = new Array(channels).fill(0);
  const confidences = new Float32Array(numPixels);

  for (let idx = 0; idx < numPixels; idx += 1) {
    // stable softmax per-pixel
    let maxLogit = -Infinity;
    for (let c = 0; c < channels; c += 1) {
      const v = values[c * numPixels + idx] as number;
      if (v > maxLogit) maxLogit = v;
    }
    let sumExp = 0;
    const probs = new Float32Array(channels);
    for (let c = 0; c < channels; c += 1) {
      const ex = Math.exp((values[c * numPixels + idx] as number) - maxLogit);
      probs[c] = ex;
      sumExp += ex;
    }
    let bestClass = 0;
    let bestProb = 0;
    for (let c = 0; c < channels; c += 1) {
      const p = probs[c] / (sumExp || 1);
      if (p > bestProb) {
        bestProb = p;
        bestClass = c;
      }
    }
    const finalClass = bestProb >= scoreThreshold ? bestClass : 0;
    mask[idx] = finalClass;
    confidences[idx] = bestProb;
    counts[finalClass] += 1;
  }

  return {
    mask: Array.from(mask),
    width: outWidth,
    height: outHeight,
    classes,
    classCounts: counts,
    confidences: Array.from(confidences),
  };
};

// FTW-specific types and functions
export type OnnxSegmentationRequest = {
  modelId: string;
  width: number;
  height: number;
  normalization: number;
  data: ArrayBuffer;
  scoreThreshold: number;
};

export type OnnxPatchRequest = {
  modelId: string;
  patchData: ArrayBuffer;
  patchWidth: number;
  patchHeight: number;
  normalization: number;
  scoreThreshold: number;
};

export type OnnxSegmentationResponse = {
  mask: number[];
  width: number;
  height: number;
  classes: string[];
  classCounts: number[];
};

export type OnnxPatchResponse = {
  mask: number[];
  width: number;
  height: number;
  classes: string[];
  confidences: number[];
};

const getModelOption = (modelId: string): ModelOption => {
  const option = MODEL_OPTIONS.find((candidate) => candidate.id === modelId);
  if (!option) {
    throw new Error(`Unknown model id "${modelId}"`);
  }
  if (option.engine !== "onnx") {
    throw new Error(`Model "${option.name}" is not an ONNX segmentation model.`);
  }
  return option;
};

export const runSegmentationInferenceClient = async (
  session: InferenceSession,
  payload: OnnxSegmentationRequest,
): Promise<OnnxSegmentationResponse> => {
  const option = getModelOption(payload.modelId);
  const floatData = new Float32Array(payload.data);

  const result = await runSegmentationInference(
    session,
    {
      data: floatData,
      width: payload.width,
      height: payload.height,
      normalization: payload.normalization,
    },
    option.classes ?? [],
    payload.scoreThreshold,
  );

  return result;
};

export const runPatchInferenceClient = async (
  session: InferenceSession,
  payload: OnnxPatchRequest,
): Promise<OnnxPatchResponse> => {
  const option = getModelOption(payload.modelId);
  const floatData = new Float32Array(payload.patchData);

  // For FTW UNet models, upsample the patch by scale factor of 2
  const {
    data: upsampledData,
    width: upsampledWidth,
    height: upsampledHeight,
  } = upsamplePatch(floatData, payload.patchWidth, payload.patchHeight, 2);

  const result = await runSegmentationInference(
    session,
    {
      data: upsampledData,
      width: upsampledWidth,
      height: upsampledHeight,
      normalization: payload.normalization,
    },
    option.classes ?? [],
    payload.scoreThreshold,
  );

  return {
    mask: result.mask,
    width: result.width,
    height: result.height,
    classes: result.classes,
    confidences: result.confidences,
  };
};
