import * as tf from "@tensorflow/tfjs";
import { fromArrayBuffer } from "geotiff";

export const PATCH_SIZE = 256;
export const MODEL_INPUT_SIZE = 512;
export interface GeoImage {
  width: number;
  height: number;
  data: Float32Array;
  channels: number;
}

export interface Patch {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Float32Array;
  channels: number;
}

export interface Detection {
  bbox: [number, number, number, number];
  score: number;
  classId: number;
  className: string;
  patchIndex: number;
  maskCoefficients: number[];
}

export interface InferenceResult {
  detections: Detection[];
  rawDetections: number[][];
}

const CLASS_NAMES = ["field"];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const sigmoid = (value: number): number =>
  1 / (1 + Math.exp(-Math.max(-60, Math.min(60, value))));

async function loadGeoTiffBands(file: File, bandCount: number): Promise<GeoImage> {
  const arrayBuffer = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();

  if (samplesPerPixel < bandCount) {
    throw new Error(
      `Expected at least ${bandCount} bands in GeoTIFF, found ${samplesPerPixel}`
    );
  }

  const raster = (await image.readRasters({
    samples: Array.from({ length: bandCount }, (_, i) => i),
    interleave: true,
  })) as Float32Array | Uint16Array | Uint8Array | Float64Array;

  const data = Float32Array.from(raster as Iterable<number>);
  return { width, height, data, channels: bandCount };
}

export const loadGeoTiffRgb = (file: File) => loadGeoTiffBands(file, 3);
export const loadGeoTiffRgbn = (file: File) => loadGeoTiffBands(file, 4);

export function extractPatches(
  image: GeoImage,
  patchSize: number = PATCH_SIZE,
  channels = 3
): Patch[] {
  const patches: Patch[] = [];
  let patchIndex = 0;

  for (let y = 0; y + patchSize <= image.height; y += patchSize) {
    for (let x = 0; x + patchSize <= image.width; x += patchSize) {
      const patchBuffer = new Float32Array(patchSize * patchSize * channels);
      for (let py = 0; py < patchSize; py += 1) {
        const sourceRow = y + py;
        const sourceOffset = sourceRow * image.width * image.channels;
        const targetOffset = py * patchSize * channels;
        for (let px = 0; px < patchSize; px += 1) {
          const sourceIndex = sourceOffset + (x + px) * image.channels;
          const targetIndex = targetOffset + px * channels;
          for (let c = 0; c < channels; c += 1) {
            patchBuffer[targetIndex + c] = image.data[sourceIndex + c];
          }
        }
      }

      patches.push({
        index: patchIndex,
        x,
        y,
        width: patchSize,
        height: patchSize,
        data: patchBuffer,
        channels,
      });
      patchIndex += 1;
    }
  }

  return patches;
}

function decodeDetectionsForPatch(
  predictions: number[][],
  patch: Patch,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold: number
): Detection[] {
  const detections: Detection[] = [];

  if (!predictions || predictions.length === 0) {
    return detections;
  }

  const numClasses = CLASS_NAMES.length;
  const vectorLength = predictions[0]?.length ?? 0;
  const maskCoeffLength = Math.max(0, vectorLength - 4 - 1 - numClasses);

  for (const raw of predictions) {
    if (!raw || raw.length < 5 + numClasses) {
      continue;
    }

    const [rawCx, rawCy, rawW, rawH] = raw;
    const objectness = sigmoid(raw[4] ?? 0);
    const classSlice = raw.slice(5, 5 + numClasses);
    const classScores = classSlice.map((score) => sigmoid(score ?? 0));
    const maxClassScore = Math.max(...classScores);
    const classId = classScores.findIndex((score) => score === maxClassScore);
    const score = objectness * maxClassScore;

    if (!Number.isFinite(score) || score < scoreThreshold) {
      continue;
    }

    const isNormalized =
      Math.max(Math.abs(rawCx), Math.abs(rawCy), Math.abs(rawW), Math.abs(rawH)) <= 1.5;

    const cxModelSpace = isNormalized ? rawCx * MODEL_INPUT_SIZE : rawCx;
    const cyModelSpace = isNormalized ? rawCy * MODEL_INPUT_SIZE : rawCy;
    const wModelSpace = isNormalized ? rawW * MODEL_INPUT_SIZE : rawW;
    const hModelSpace = isNormalized ? rawH * MODEL_INPUT_SIZE : rawH;

    const scaleX = patch.width / MODEL_INPUT_SIZE;
    const scaleY = patch.height / MODEL_INPUT_SIZE;

    const cxPixels = cxModelSpace * scaleX;
    const cyPixels = cyModelSpace * scaleY;
    const wPixels = Math.max(0, wModelSpace * scaleX);
    const hPixels = Math.max(0, hModelSpace * scaleY);

    const x1 = clamp(patch.x + cxPixels - wPixels / 2, 0, imageWidth);
    const y1 = clamp(patch.y + cyPixels - hPixels / 2, 0, imageHeight);
    const x2 = clamp(patch.x + cxPixels + wPixels / 2, 0, imageWidth);
    const y2 = clamp(patch.y + cyPixels + hPixels / 2, 0, imageHeight);

    if (x2 <= x1 || y2 <= y1 || wPixels <= 1 || hPixels <= 1) {
      continue;
    }

    const maskCoefficients =
      maskCoeffLength > 0 ? raw.slice(5 + numClasses) : [];

    detections.push({
      bbox: [x1, y1, x2, y2],
      score,
      classId: classId >= 0 ? classId : 0,
      className:
        CLASS_NAMES[classId] ?? `class_${classId >= 0 ? classId : 0}`,
      patchIndex: patch.index,
      maskCoefficients,
    });
  }

  return detections;
}

export async function runModelOnPatch(
  model: tf.GraphModel,
  patch: Patch,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold: number,
  normalizationDivisor: number
): Promise<Detection[]> {
  const batchedInput = tf.tidy(() => {
    if (patch.channels !== 3) {
      throw new Error(
        `Expected patch with 3 channels for TFJS model, received ${patch.channels}`
      );
    }
    const tensor = tf.tensor(patch.data, [patch.height, patch.width, patch.channels], "float32");
    const safeDivisor = normalizationDivisor > 0 ? normalizationDivisor : 1;
    const normalized = tensor.div(safeDivisor).clipByValue(0, 1);
    const resized = tf.image.resizeBilinear(
      normalized as tf.Tensor3D,
      [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE],
      true
    );
    const batched = resized.expandDims(0);
    return batched;
  });

  try {
    const outputs = await model.executeAsync(batchedInput, [
      "Identity:0",
      "Identity_1:0",
    ]);

    if (!Array.isArray(outputs) || outputs.length < 1) {
      throw new Error("Unexpected model output structure.");
    }

    const rawDetections = outputs[0];

    const detectionsArray = await rawDetections.array();
    rawDetections.dispose();

    if (outputs.length > 1) {
      outputs.slice(1).forEach((tensor) => tensor.dispose());
    }

    batchedInput.dispose();

    const [predictions] = detectionsArray as number[][][];
    return decodeDetectionsForPatch(
      predictions ?? [],
      patch,
      imageWidth,
      imageHeight,
      scoreThreshold
    );
  } catch (error) {
    batchedInput.dispose();
    throw error;
  }
}

export function boxIou(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number]
): number {
  const x1 = Math.max(boxA[0], boxB[0]);
  const y1 = Math.max(boxA[1], boxB[1]);
  const x2 = Math.min(boxA[2], boxB[2]);
  const y2 = Math.min(boxA[3], boxB[3]);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection <= 0) {
    return 0;
  }

  const areaA = Math.max(0, boxA[2] - boxA[0]) * Math.max(0, boxA[3] - boxA[1]);
  const areaB = Math.max(0, boxB[2] - boxB[0]) * Math.max(0, boxB[3] - boxB[1]);

  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

export function boxNms(
  detections: Detection[],
  iouThreshold = 0.3,
  scoreThreshold = 0.05
): Detection[] {
  const filtered = detections
    .filter((d) => Number.isFinite(d.score) && d.score >= scoreThreshold)
    .sort((a, b) => b.score - a.score);

  const finalDetections: Detection[] = [];

  for (const det of filtered) {
    let shouldSelect = true;
    for (const selected of finalDetections) {
      const overlap = boxIou(det.bbox, selected.bbox);
      if (overlap > iouThreshold) {
        shouldSelect = false;
        break;
      }
    }
    if (shouldSelect) {
      finalDetections.push(det);
    }
  }

  return finalDetections;
}
