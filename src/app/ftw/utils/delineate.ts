import * as tf from "@tensorflow/tfjs";
import { fromArrayBuffer } from "geotiff";
import { extractPatches as extractPatchesShared, GeoImage, Patch } from "./common";

export const PATCH_SIZE = 256;
export const MODEL_INPUT_SIZE = 512;

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

const softmax = (logits: number[]): number[] => {
  if (logits.length === 0) return logits;
  const maxLogit = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  return sum > 0 ? exps.map((e) => e / sum) : logits.map(() => 0);
};

const computeClassScores = (logits: number[], numClasses: number): number[] =>
  numClasses <= 1 ? [sigmoid(logits[0] ?? 0)] : softmax(logits);

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

export const extractPatches = (
  image: GeoImage,
  patchSize: number = PATCH_SIZE,
  channels = 3
): Patch[] => extractPatchesShared(image, patchSize, channels) as Patch[];

function decodeDetectionsForPatch(
  predictions: number[][],
  patch: Patch,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold: number,
  bboxFormat: 'xywh' | 'xyxy' | 'auto' = 'xywh'
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

    const [a, b, c, d] = raw;
    const objectness = sigmoid(raw[4] ?? 0);
    const classSlice = raw.slice(5, 5 + numClasses);
    const classScores = computeClassScores(classSlice, numClasses);
    const maxClassScore = Math.max(...classScores);
    const classId = numClasses <= 1 ? 0 : classScores.findIndex((score) => score === maxClassScore);
    const score = objectness * maxClassScore;

    if (!Number.isFinite(score) || score < scoreThreshold) {
      continue;
    }

    const isNormalized = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)) <= 1.5;
    const toModelSpace = (v: number) => (isNormalized ? v * MODEL_INPUT_SIZE : v);
    const scaleX = patch.width / MODEL_INPUT_SIZE;
    const scaleY = patch.height / MODEL_INPUT_SIZE;

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    const makeBoxFromXyxy = (): [number, number, number, number] => {
      const x1m = toModelSpace(a) * scaleX;
      const y1m = toModelSpace(b) * scaleY;
      const x2m = toModelSpace(c) * scaleX;
      const y2m = toModelSpace(d) * scaleY;
      const bx1 = clamp(patch.x + Math.min(x1m, x2m), 0, imageWidth);
      const by1 = clamp(patch.y + Math.min(y1m, y2m), 0, imageHeight);
      const bx2 = clamp(patch.x + Math.max(x1m, x2m), 0, imageWidth);
      const by2 = clamp(patch.y + Math.max(y1m, y2m), 0, imageHeight);
      return [bx1, by1, bx2, by2];
    };

    const makeBoxFromXywh = (): [number, number, number, number] => {
      const cxm = toModelSpace(a);
      const cym = toModelSpace(b);
      const wm = toModelSpace(c);
      const hm = toModelSpace(d);
      const cxPixels = cxm * scaleX;
      const cyPixels = cym * scaleY;
      const wPixels = Math.max(0, wm * scaleX);
      const hPixels = Math.max(0, hm * scaleY);
      const bx1 = clamp(patch.x + cxPixels - wPixels / 2, 0, imageWidth);
      const by1 = clamp(patch.y + cyPixels - hPixels / 2, 0, imageHeight);
      const bx2 = clamp(patch.x + cxPixels + wPixels / 2, 0, imageWidth);
      const by2 = clamp(patch.y + cyPixels + hPixels / 2, 0, imageHeight);
      return [bx1, by1, bx2, by2];
    };

    if (bboxFormat === 'auto') {
      const boxA = makeBoxFromXyxy();
      const boxB = makeBoxFromXywh();
      const area = (bx: [number, number, number, number]) => Math.max(0, bx[2] - bx[0]) * Math.max(0, bx[3] - bx[1]);
      const areaA = area(boxA);
      const areaB = area(boxB);
      const patchArea = patch.width * patch.height;
      const valid = (ar: number) => ar > 1 && ar <= patchArea;
      const chooseA = valid(areaA) && (!valid(areaB) || areaA <= patchArea && areaA >= areaB * 0.25);
      [x1, y1, x2, y2] = chooseA ? boxA : boxB;
    } else if (bboxFormat === 'xyxy') {
      [x1, y1, x2, y2] = makeBoxFromXyxy();
    } else {
      [x1, y1, x2, y2] = makeBoxFromXywh();
    }

    const boxW = x2 - x1;
    const boxH = y2 - y1;
    if (x2 <= x1 || y2 <= y1 || boxW <= 1 || boxH <= 1) {
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
  normalizationDivisor: number,
  bboxFormat: 'xywh' | 'xyxy' | 'auto' = 'xywh'
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
      scoreThreshold,
      bboxFormat
    );
  } catch (error) {
    batchedInput.dispose();
    throw error;
  }
}

export async function nonMaxSuppressionTf(
  detections: Detection[],
  iouThreshold = 0.3,
  scoreThreshold = 0.05
): Promise<Detection[]> {
  const filtered = detections.filter(
    (d) => Number.isFinite(d.score) && d.score >= scoreThreshold
  );
  if (filtered.length === 0) return [];

  const boxesData = new Float32Array(filtered.length * 4);
  const scoresData = new Float32Array(filtered.length);
  for (let i = 0; i < filtered.length; i += 1) {
    const [x1, y1, x2, y2] = filtered[i].bbox;
    boxesData[i * 4] = y1;
    boxesData[i * 4 + 1] = x1;
    boxesData[i * 4 + 2] = y2;
    boxesData[i * 4 + 3] = x2;
    scoresData[i] = filtered[i].score;
  }
  const boxes = tf.tensor2d(boxesData, [filtered.length, 4], 'float32');
  const scores = tf.tensor1d(scoresData, 'float32');
  const maxOutput = filtered.length;
  const idx = await tf.image.nonMaxSuppressionAsync(
    boxes,
    scores,
    maxOutput,
    iouThreshold,
    scoreThreshold
  );
  const indices = Array.from(await idx.data());
  boxes.dispose();
  scores.dispose();
  idx.dispose();
  return indices.map((i) => filtered[i]);
}
