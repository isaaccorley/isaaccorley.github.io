'use client';

import type { GraphModel } from '@tensorflow/tfjs';
import * as tf from '@tensorflow/tfjs';
import Image from 'next/image';
import type { InferenceSession } from 'onnxruntime-web';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import bannerImage from './banner3.webp';
import type { GeoImage, Patch } from './utils/common';
import * as delineateUtils from './utils/delineate';
import { Detection, extractPatches, nonMaxSuppressionTf, runModelOnPatch } from './utils/delineate';
import { runPatchInferenceClient } from './utils/ftw';
import {
  MODEL_OPTIONS,
  type ModelOption,
  loadModelFromOption,
} from './utils/model-loader';

const RANDOM_URLS_TXT =
  'https://raw.githubusercontent.com/isaaccorley/isaaccorley.github.io/refs/heads/main/src/app/ftw/utils/ftw_urls.txt';

async function configureTfBackendOnce(): Promise<{ backend: string; error: string | null }> {
  try {
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalLog = console.log;
    try {
      console.warn = () => {};
      console.info = () => {};
      console.log = () => {};
      await tf.ready();
    } finally {
      console.warn = originalWarn;
      console.info = originalInfo;
      console.log = originalLog;
    }
    
    // For ONNX models, we don't need to configure TensorFlow.js backends
    // They run server-side via the ONNX runtime
    const backend = tf.getBackend();
    return { backend, error: null };
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js backend:', error);
    return { 
      backend: 'cpu', 
      error: error instanceof Error ? error.message : 'Unknown backend error' 
    };
  }
}

const DEFAULT_SCORE_THRESHOLD = 0.05;
const DEFAULT_IOU_THRESHOLD = 0.3;
const DEFAULT_NORMALIZATION = 3000;
const NORMALIZATION_MIN = 100;
const NORMALIZATION_MAX = 10000;
const NORMALIZATION_STEP = 100;
const PATCH_MIN = 64;
const PATCH_MAX = 1024;
const PATCH_STEP = 32;

type ImageInfo = {
  width: number;
  height: number;
  patchCount: number;
  fileName: string;
};

const clampColor = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

const clampNormalization = (value: number) =>
  Math.max(NORMALIZATION_MIN, Math.min(NORMALIZATION_MAX, value));

const clampPatchSize = (value: number) =>
  Math.max(
    PATCH_MIN,
    Math.min(PATCH_MAX, Math.round(value / PATCH_STEP) * PATCH_STEP)
  );

function buildImageData(image: GeoImage, normalization: number): ImageData {
  const { width, height, data } = image;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const safeNormalization = normalization > 0 ? normalization : DEFAULT_NORMALIZATION;
  const scale = 255 / safeNormalization;

  for (let i = 0; i < width * height; i += 1) {
    const base = i * image.channels;
    rgba[i * 4] = clampColor(data[base] * scale);
    rgba[i * 4 + 1] = clampColor(data[base + 1] * scale);
    rgba[i * 4 + 2] = clampColor(data[base + 2] * scale);
    rgba[i * 4 + 3] = 255;
  }

  return new ImageData(rgba, width, height);
}

export default function DelineatePage() {
  const [model, setModel] = useState<GraphModel | InferenceSession | null>(null);
  const [modelStatus, setModelStatus] = useState('Loading model…');
  const [processingStatus, setProcessingStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [rawDetections, setRawDetections] = useState<Detection[]>([]);
  const [rawDetectionCount, setRawDetectionCount] = useState(0);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scoreThreshold, setScoreThreshold] = useState(DEFAULT_SCORE_THRESHOLD);
  const [iouThreshold, setIouThreshold] = useState(DEFAULT_IOU_THRESHOLD);
  const [normalizationFactor, setNormalizationFactor] =
    useState<number>(DEFAULT_NORMALIZATION);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    'ftw-unet-fp16'
  );
  const [patchSize, setPatchSize] = useState<number>(256);
  const [backendName, setBackendName] = useState<string>('initializing');
  const [backendError, setBackendError] = useState<string | null>(null);
  const [maskOpacity, setMaskOpacity] = useState<number>(0.4);
  const [, setSegmentationCounts] = useState<number[] | null>(null);
  const [, setSegmentationClasses] = useState<string[]>([]);
  const [segmentationProbs, setSegmentationProbs] = useState<Float32Array | null>(null);
  const [segmentationDimensions, setSegmentationDimensions] = useState<
    { width: number; height: number } | null
  >(null);
  const [positiveClassIndex, setPositiveClassIndex] = useState<number>(1);
  const [imageLabel, setImageLabel] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const geoImageRef = useRef<GeoImage | null>(null);
  const patchesRef = useRef<Patch[] | null>(null);
  const pendingNormalizationRef = useRef<number | null>(null);
  const lastNormalizationUsedRef = useRef<number>(DEFAULT_NORMALIZATION);
  const pendingPatchSizeRef = useRef<number | null>(null);
  const lastPatchSizeUsedRef = useRef<number>(patchSize);
  const fileNameRef = useRef<string>('Uploaded image');
  const paintRequestIdRef = useRef(0);
  const semanticMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizationDebounceIdRef = useRef<number | null>(null);

  const selectedModel = useMemo<ModelOption | undefined>(
    () => MODEL_OPTIONS.find((candidate) => candidate.id === selectedModelId),
    [selectedModelId]
  );
  const isSegmentation = selectedModel?.engine === 'onnx';
  const numSegmentationPixels = segmentationDimensions
    ? segmentationDimensions.width * segmentationDimensions.height
    : 0;
  const segmentationChannelCount = segmentationProbs && numSegmentationPixels > 0
    ? Math.round(segmentationProbs.length / numSegmentationPixels)
    : 0;

  const hexToRgb = (hex: string): [number, number, number] => {
    const sanitized = hex.replace('#', '');
    const value = sanitized.length === 3
      ? sanitized.split('').map((ch) => ch + ch).join('')
      : sanitized.padEnd(6, '0');
    const num = Number.parseInt(value, 16);
    return [
      (num >> 16) & 0xff,
      (num >> 8) & 0xff,
      num & 0xff,
    ];
  };

  const waitForOnnxSession = useCallback(async (): Promise<InferenceSession> => {
    const maxAttempts = 30;
    const delayMs = 200;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = model as InferenceSession | null;
      if (current && typeof (current as InferenceSession).run === 'function') {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error('ONNX session is not ready. Please wait for the model to finish loading.');
  }, [model]);

  const parseFtwLabelFromUrl = useCallback((url: string): string | null => {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const countryIdx = parts.findIndex((p) => p === 'fields-of-the-world');
      if (countryIdx < 0 || countryIdx + 3 >= parts.length) return null;
      const countryRaw = parts[countryIdx + 1] ?? '';
      const windowRaw = parts[countryIdx + 3] ?? '';
      const file = parts[parts.length - 1] ?? '';
      const season = windowRaw === 'window_a' ? 'Planting' : windowRaw === 'window_b' ? 'Harvest' : windowRaw;
      const country = countryRaw.charAt(0).toUpperCase() + countryRaw.slice(1);
      return `${country} · ${season} · ${file}`;
    } catch {
      return null;
    }
  }, []);

  const sampleRandomUrl = useCallback(async (): Promise<string> => {
    const head = await fetch(RANDOM_URLS_TXT, { method: 'HEAD', cache: 'no-store' });
    const lenStr = head.headers.get('content-length');
    const total = lenStr ? Number(lenStr) : NaN;
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('Unable to determine list size');
    }
    const windowBytes = 64 * 1024;
    const start = Math.floor(Math.random() * Math.max(1, total - 1));
    const end = Math.min(total - 1, start + windowBytes - 1);
    const res = await fetch(RANDOM_URLS_TXT, {
      headers: { Range: `bytes=${start}-${end}` },
      cache: 'no-store',
    });
    if (res.status !== 206) {
      throw new Error('Server must support HTTP Range');
    }
    const chunk = await res.text();
    const lines = chunk.split(/\n/);
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line) {
        return line;
      }
    }
    const backStart = Math.max(0, start - windowBytes);
    const backEnd = Math.max(0, start - 1);
    if (backEnd > backStart) {
      const backRes = await fetch(RANDOM_URLS_TXT, {
        headers: { Range: `bytes=${backStart}-${backEnd}` },
        cache: 'no-store',
      });
      if (backRes.status === 206) {
        const backChunk = await backRes.text();
        const backLines = backChunk.split(/\n/).filter((s) => s.trim().length > 0);
        if (backLines.length > 0) {
          return backLines[backLines.length - 1].trim();
        }
      }
    }
    throw new Error('Could not sample a line');
  }, []);

  // handleRandomClick declared later after processGeoTiffFile

  const segmentationMaskData = useMemo(() => {
    if (!isSegmentation || !segmentationProbs || !segmentationDimensions) {
      return null;
    }

    const { width, height } = segmentationDimensions;
    const numPixels = width * height;
    if (
      numPixels === 0 ||
      segmentationChannelCount === 0 ||
      segmentationProbs.length !== segmentationChannelCount * numPixels
    ) {
      return null;
    }

    const targetClass = Math.min(Math.max(positiveClassIndex, 0), segmentationChannelCount - 1);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const imageData = ctx.createImageData(width, height);
    const palette = selectedModel?.palette ?? ['#4caf50'];
    const [r, g, b] = hexToRgb(palette[targetClass] ?? '#4caf50');

    const counts = new Array(segmentationChannelCount).fill(0);
    for (let channel = 0; channel < segmentationChannelCount; channel += 1) {
      const offset = channel * numPixels;
      let count = 0;
      const isTarget = channel === targetClass;
      for (let idx = 0; idx < numPixels; idx += 1) {
        const prob = segmentationProbs[offset + idx];
        if (prob >= scoreThreshold) {
          count += 1;
        }
        if (isTarget) {
          const pixelOffset = idx * 4;
          if (prob >= scoreThreshold) {
            imageData.data[pixelOffset] = r;
            imageData.data[pixelOffset + 1] = g;
            imageData.data[pixelOffset + 2] = b;
            imageData.data[pixelOffset + 3] = 255;
          } else {
            imageData.data[pixelOffset + 3] = 0;
          }
        }
      }
      counts[channel] = count;
    }

    ctx.putImageData(imageData, 0, 0);
    return { canvas, counts };
  }, [
    isSegmentation,
    positiveClassIndex,
    scoreThreshold,
    segmentationChannelCount,
    segmentationDimensions,
    segmentationProbs,
    selectedModel,
  ]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { backend, error } = await configureTfBackendOnce();
        if (!cancelled) {
          setBackendName(backend);
          setBackendError(error);
        }
      } catch (error) {
        console.warn('Failed to configure TensorFlow.js backend', error);
        if (!cancelled) {
          setBackendName(tf.getBackend());
          setBackendError('Failed to initialise TensorFlow.js backend.');
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateBaseImageData = useCallback((image: GeoImage, normalization: number) => {
    imageDataRef.current = buildImageData(image, normalization);
  }, []);

  const paintCanvas = useCallback(
    (boxes: Detection[], infoOverride?: ImageInfo) => {
      const info = infoOverride ?? imageInfo;
      const baseImageData = imageDataRef.current;
      if (!info || !baseImageData) {
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        return;
      }

      canvas.width = info.width;
      canvas.height = info.height;

      const requestId = ++paintRequestIdRef.current;
      ctx.putImageData(baseImageData, 0, 0);

      const maskCanvas = semanticMaskCanvasRef.current;
      if (maskCanvas) {
        ctx.save();
        ctx.globalAlpha = maskOpacity;
        ctx.drawImage(maskCanvas, 0, 0, info.width, info.height);
        ctx.restore();
      }

      if (paintRequestIdRef.current !== requestId) {
        return;
      }

      ctx.lineWidth = 1;
      ctx.font = '8px sans-serif';
      ctx.textBaseline = 'top';

      boxes.forEach((det) => {
        const [x1, y1, x2, y2] = det.bbox;
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.strokeStyle = '#ff4d4f';
        ctx.strokeRect(x1, y1, w, h);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${det.className} ${(det.score * 100).toFixed(1)}%`, x1 + 2, y1 + 1);
      });
    },
    [imageInfo, maskOpacity]
  );

  const runPatchesInference = useCallback(
    async (
      patches: Patch[],
      geoImg: GeoImage,
      normalizationValue: number,
      label: string
    ) => {
      if (!model) {
        throw new Error('Model is not ready yet.');
      }
      
      // Check if this is a TensorFlow.js model
      if ('executeAsync' in model) {
        const aggregated: Detection[] = [];
        for (let i = 0; i < patches.length; i += 1) {
          setProcessingStatus(`${label}: patch ${i + 1} of ${patches.length}…`);
          const patchDetections = await runModelOnPatch(
            model as GraphModel,
            patches[i],
            geoImg.width,
            geoImg.height,
            scoreThreshold,
            normalizationValue,
            'auto'
          );
          aggregated.push(...patchDetections);
        }
        return aggregated;
      } else {
        // This is an ONNX model - use segmentation processing instead
        throw new Error('ONNX models should use segmentation processing, not detection processing.');
      }
    },
    [model, scoreThreshold]
  );

  const runDetectionsWithNormalization = useCallback(
    async (normalizationValue: number, label: string) => {
      const geoImage = geoImageRef.current;
      const patches = patchesRef.current;
      if (!geoImage || !patches || patches.length === 0 || !model) {
        return;
      }

      setIsProcessing(true);
      try {
        setProcessingStatus('Running Inference');
        const aggregatedDetections = await runPatchesInference(
          patches,
          geoImage,
          normalizationValue,
          label
        );
        lastNormalizationUsedRef.current = normalizationValue;
        setRawDetectionCount(aggregatedDetections.length);
        setRawDetections(aggregatedDetections);
        const nmsDetections = await nonMaxSuppressionTf(
          aggregatedDetections,
          iouThreshold,
          scoreThreshold
        );
        setDetections(nmsDetections);
        setProcessingStatus('Done');
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to run inference with the selected normalization.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [runPatchesInference, iouThreshold, scoreThreshold, model]
  );

  const runDetectionsWithPatchSize = useCallback(
    async (newPatchSize: number, label: string) => {
      const geoImage = geoImageRef.current;
      if (!geoImage || !model) {
        return;
      }

      setIsProcessing(true);
      try {
        setProcessingStatus('Running Inference');
        const patches = extractPatches(geoImage, newPatchSize, geoImage.channels);
        patchesRef.current = patches;
        lastPatchSizeUsedRef.current = newPatchSize;
        lastNormalizationUsedRef.current = normalizationFactor;

        const info: ImageInfo = {
          width: geoImage.width,
          height: geoImage.height,
          patchCount: patches.length,
          fileName: fileNameRef.current,
        };

        setImageInfo(info);
        updateBaseImageData(geoImage, normalizationFactor);
        semanticMaskCanvasRef.current = null;
        setSegmentationCounts(null);
        paintCanvas([], info);

        const aggregatedDetections = await runPatchesInference(
          patches,
          geoImage,
          normalizationFactor,
          label
        );
        setRawDetectionCount(aggregatedDetections.length);
        setRawDetections(aggregatedDetections);
        const nmsDetections = await nonMaxSuppressionTf(
          aggregatedDetections,
          iouThreshold,
          scoreThreshold
        );
        setDetections(nmsDetections);
        setProcessingStatus('Done');
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to run inference with the selected patch size.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      iouThreshold,
      model,
      normalizationFactor,
      paintCanvas,
      runPatchesInference,
      scoreThreshold,
      updateBaseImageData,
    ]
  );

  const runSegmentation = useCallback(
    async (normalization: number, label: string) => {
      const option = selectedModel;
      const geoImage = geoImageRef.current;
      const info = imageInfo;
      if (!option || option.engine !== 'onnx' || !geoImage) {
        return;
      }

      setIsProcessing(true);
      try {
        // Ensure ONNX session is ready before proceeding
        await waitForOnnxSession();
        setProcessingStatus('Running Inference');
        updateBaseImageData(geoImage, normalization);
        if (info) {
          paintCanvas([], info);
        }

        // Extract patches using the same logic as TensorFlow.js models
        const patches = extractPatches(geoImage, patchSize, geoImage.channels);
        
        // Create output mask array for the full image
        const fullMask = new Uint8Array(geoImage.width * geoImage.height);
        const classCounts = new Array(option.classes?.length ?? 3).fill(0);

        // Process each patch
        for (let i = 0; i < patches.length; i += 1) {
          setProcessingStatus(`${label}: patch ${i + 1} of ${patches.length}…`);
          
          const patch = patches[i];
          const patchData = patch.data.buffer.slice(
            patch.data.byteOffset, 
            patch.data.byteOffset + patch.data.byteLength
          ) as ArrayBuffer;

          const response = await runPatchInferenceClient(
            model as InferenceSession,
            {
              modelId: option.id,
              patchData,
              patchWidth: patch.width,
              patchHeight: patch.height,
              normalization,
              scoreThreshold,
            }
          );

          // Write patch results to full mask
          // Note: The model output is at 2x resolution due to upsampling
          const patchMask = response.mask;
          const modelOutputWidth = response.width;
          const modelOutputHeight = response.height;
          
          // Scale factor from model output back to patch size (should be 2x due to upsampling)
          const scaleX = modelOutputWidth / patch.width;
          const scaleY = modelOutputHeight / patch.height;

          for (let py = 0; py < patch.height; py += 1) {
            for (let px = 0; px < patch.width; px += 1) {
              // Map patch coordinates to model output coordinates
              const maskX = Math.floor(px * scaleX);
              const maskY = Math.floor(py * scaleY);
              const maskIdx = maskY * modelOutputWidth + maskX;
              
              if (maskIdx < patchMask.length) {
                const classId = patchMask[maskIdx];
                const fullX = patch.x + px;
                const fullY = patch.y + py;
                
                if (fullX < geoImage.width && fullY < geoImage.height) {
                  const fullIdx = fullY * geoImage.width + fullX;
                  fullMask[fullIdx] = classId;
                  classCounts[classId] += 1;
                }
              }
            }
          }
        }

        setSegmentationCounts(classCounts);
        setSegmentationClasses(option.classes ?? []);
        lastNormalizationUsedRef.current = normalization;

        // Create mask canvas
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = geoImage.width;
        maskCanvas.height = geoImage.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) {
          throw new Error('Unable to create mask canvas context.');
        }

        const maskImageData = maskCtx.createImageData(geoImage.width, geoImage.height);
        const palette = option.palette ?? ['#000000', '#66bb6a', '#ffb74d'];
        const toRgb = (hex: string): [number, number, number] => {
          const sanitized = hex.replace('#', '');
          const value = sanitized.length === 3
            ? sanitized.split('').map((ch) => ch + ch).join('')
            : sanitized.padEnd(6, '0');
          const num = Number.parseInt(value, 16);
          return [
            (num >> 16) & 0xff,
            (num >> 8) & 0xff,
            num & 0xff,
          ];
        };

        for (let i = 0; i < fullMask.length; i += 1) {
          const classId = fullMask[i];
          const [r, g, b] = toRgb(palette[classId] ?? '#ffffff');
          const offset = i * 4;
          maskImageData.data[offset] = r;
          maskImageData.data[offset + 1] = g;
          maskImageData.data[offset + 2] = b;
          maskImageData.data[offset + 3] = classId === 0 ? 0 : 255;
        }

        maskCtx.putImageData(maskImageData, 0, 0);
        semanticMaskCanvasRef.current = maskCanvas;

        const newInfo: ImageInfo = {
          width: geoImage.width,
          height: geoImage.height,
          patchCount: patches.length,
          fileName: fileNameRef.current,
        };
        setImageInfo((prev) => prev ?? newInfo);
        paintCanvas([], newInfo);
        setRawDetectionCount(0);
        setDetections([]);
        setRawDetections([]);
        setProcessingStatus('Done');
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to run ONNX segmentation inference.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [imageInfo, paintCanvas, scoreThreshold, selectedModel, updateBaseImageData, patchSize, model, waitForOnnxSession]
  );

  const processPendingWork = useCallback(() => {
    if (isProcessing) {
      return;
    }

    const option = selectedModel;
    if (!option) {
      return;
    }

    const geoImage = geoImageRef.current;
    if (!geoImage) {
      return;
    }

    if (option.engine === 'onnx') {
      // Handle patch size changes for ONNX models
      if (pendingPatchSizeRef.current != null) {
        const nextPatchSize = pendingPatchSizeRef.current;
        pendingPatchSizeRef.current = null;
        if (nextPatchSize != null) {
          void runSegmentation(normalizationFactor, 'Re-running segmentation with new patch size');
        }
      }

      // Handle normalization changes for ONNX models
      if (pendingNormalizationRef.current != null) {
        const next = pendingNormalizationRef.current;
        pendingNormalizationRef.current = null;
        if (next != null) {
          void runSegmentation(next, 'Re-running segmentation');
        }
      }
      return;
    }

    if (!model) {
      return;
    }

    if (
      pendingPatchSizeRef.current != null &&
      pendingPatchSizeRef.current === lastPatchSizeUsedRef.current
    ) {
      pendingPatchSizeRef.current = null;
    }

    if (
      pendingPatchSizeRef.current != null &&
      pendingPatchSizeRef.current !== lastPatchSizeUsedRef.current
    ) {
      const nextSize = pendingPatchSizeRef.current;
      pendingPatchSizeRef.current = null;
      void runDetectionsWithPatchSize(nextSize, 'Re-running inference');
      return;
    }

    if (
      pendingNormalizationRef.current != null &&
      pendingNormalizationRef.current !== lastNormalizationUsedRef.current
    ) {
      const nextNorm = pendingNormalizationRef.current;
      pendingNormalizationRef.current = null;
      void runDetectionsWithNormalization(nextNorm, 'Re-running inference');
      return;
    }

    if (
      pendingNormalizationRef.current != null &&
      pendingNormalizationRef.current === lastNormalizationUsedRef.current
    ) {
      pendingNormalizationRef.current = null;
    }
  }, [
    isProcessing,
    model,
    normalizationFactor,
    runDetectionsWithNormalization,
    runDetectionsWithPatchSize,
    runSegmentation,
    selectedModel,
  ]);

  const handleNormalizationUpdate = useCallback(
    (value: number) => {
      const clamped = clampNormalization(value);
      setNormalizationFactor(clamped);

      const geoImage = geoImageRef.current;
      const info = imageInfo;
      if (geoImage && info) {
        updateBaseImageData(geoImage, clamped);
        void paintCanvas(detections, info);
      }

      pendingNormalizationRef.current = clamped;

      if (normalizationDebounceIdRef.current != null) {
        window.clearTimeout(normalizationDebounceIdRef.current);
        normalizationDebounceIdRef.current = null;
      }

      normalizationDebounceIdRef.current = window.setTimeout(() => {
        const next = pendingNormalizationRef.current;
        pendingNormalizationRef.current = null;
        if (next == null) {
          return;
        }
        if (isProcessing) {
          return;
        }
        if (isSegmentation) {
          void runSegmentation(next, 'Re-running segmentation');
          return;
        }
        const patches = patchesRef.current;
        if (!geoImage || !patches || patches.length === 0 || !model) {
          return;
        }
        void runDetectionsWithNormalization(next, 'Re-running inference');
      }, 250);
    },
    [
      detections,
      imageInfo,
      isProcessing,
      isSegmentation,
      model,
      paintCanvas,
      runDetectionsWithNormalization,
      runSegmentation,
      updateBaseImageData,
    ]
  );

  const handlePatchSizeChange = useCallback(
    (value: number) => {
      const clamped = clampPatchSize(value);
      setPatchSize(clamped);

      pendingPatchSizeRef.current = clamped;

      const geoImage = geoImageRef.current;
      if (!geoImage) {
        return;
      }

      if (isProcessing) {
        return;
      }

      const next = pendingPatchSizeRef.current;
      pendingPatchSizeRef.current = null;
      if (next != null) {
        if (isSegmentation) {
          void runSegmentation(normalizationFactor, 'Re-running segmentation');
        } else {
          void runDetectionsWithPatchSize(next, 'Re-running inference');
        }
      }
    },
    [isProcessing, isSegmentation, normalizationFactor, runDetectionsWithPatchSize, runSegmentation]
  );

  useEffect(() => {
    if (!isProcessing) {
      processPendingWork();
    }
  }, [isProcessing, processPendingWork]);

  useEffect(() => {
    if (!isSegmentation) {
      return;
    }

    if (!segmentationMaskData) {
      semanticMaskCanvasRef.current = null;
      setSegmentationCounts(null);
      if (imageInfo) {
        paintCanvas([]);
      }
      return;
    }

    semanticMaskCanvasRef.current = segmentationMaskData.canvas;
    setSegmentationCounts(segmentationMaskData.counts);
    if (imageInfo) {
      paintCanvas([]);
    }
  }, [imageInfo, isSegmentation, paintCanvas, segmentationMaskData]);

  useEffect(() => {
    void paintCanvas(detections);
  }, [maskOpacity, detections, paintCanvas]);
  useEffect(() => {
    if (backendName === 'initializing') {
      return;
    }

    const option = selectedModel;

    if (!option) {
      setErrorMessage('Unknown model selected.');
      setModelStatus('Model selection error');
      return;
    }

    let isCancelled = false;

    setModel((previous) => {
      if (previous && 'dispose' in previous) {
        (previous as GraphModel).dispose();
      }
      return null;
    });
    setDetections([]);
    setRawDetections([]);
    setRawDetectionCount(0);
    setProcessingStatus('');
    setImageInfo(null);
    setErrorMessage(null);
    geoImageRef.current = null;
    patchesRef.current = null;
    imageDataRef.current = null;
    pendingPatchSizeRef.current = null;
    setSegmentationCounts(null);
    setSegmentationClasses(option.classes ?? []);
    setSegmentationProbs(null);
    setSegmentationDimensions(null);
    setPositiveClassIndex(option.classes && option.classes.length > 1 ? 1 : 0);
    semanticMaskCanvasRef.current = null;
    if (option.engine === 'onnx') {
      setMaskOpacity(0.25);
    }

    const loadSelectedModel = async () => {
      try {
        setModelStatus(`Loading ${option.name}…`);
        const loadedModel = await loadModelFromOption(option);
        if (isCancelled) {
          if (option.engine === 'tfjs' && 'dispose' in loadedModel) {
            (loadedModel as GraphModel).dispose();
          }
          return;
        }
        setModel(loadedModel);
        setModelStatus(`Model ready: ${option.name}`);
        
        if (option.engine === 'onnx') {
          setBackendName('onnx-web');
        } else {
          setBackendName(tf.getBackend());
        }
        setBackendError(null);
      } catch (err) {
        if (isCancelled) {
          return;
        }
        console.error('Model loading error:', err);
        console.error('Model option:', option);
        setErrorMessage(
          err instanceof Error
            ? `Failed to load model "${option.name}": ${err.message}`
            : `Failed to load model "${option.name}".`
        );
        setModelStatus(`Model failed to load: ${option.name}`);
      }
    };

    void loadSelectedModel();

    return () => {
      isCancelled = true;
    };
  }, [selectedModel, backendName]);
  useEffect(() => {
    if (isSegmentation) {
      setDetections([]);
      return;
    }

    if (rawDetections.length === 0) {
      setDetections([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const updated = await nonMaxSuppressionTf(
        rawDetections,
        iouThreshold,
        scoreThreshold
      );
      if (!cancelled) {
        setDetections(updated);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawDetections, iouThreshold, scoreThreshold, isSegmentation]);

  useEffect(() => {
    void paintCanvas(detections);
  }, [detections, paintCanvas]);

  useEffect(() => {
    if (
      isProcessing ||
      rawDetections.length === 0 ||
      Number.isNaN(detections.length)
    ) {
      return;
    }

    setProcessingStatus('Done');
  }, [
    detections.length,
    iouThreshold,
    isProcessing,
    rawDetections.length,
    scoreThreshold,
  ]);

  const processGeoTiffFile = useCallback(
    async (file: File) => {
      const option = selectedModel;
      if (!option) {
        setErrorMessage('No model selected.');
        return;
      }

      setErrorMessage(null);
      setDetections([]);
      setRawDetections([]);
      setRawDetectionCount(0);
      setProcessingStatus('Reading GeoTIFF…');
      pendingNormalizationRef.current = null;

      if (option.engine === 'onnx') {
        try {
          setSegmentationProbs(null);
          setSegmentationDimensions(null);
          setSegmentationCounts(null);
          const geoImage = await delineateUtils.loadGeoTiffRgbn(file);
          geoImageRef.current = geoImage;
          fileNameRef.current = file.name;

          const info: ImageInfo = {
            width: geoImage.width,
            height: geoImage.height,
            patchCount: 1,
            fileName: file.name,
          };

          setImageInfo(info);
          updateBaseImageData(geoImage, normalizationFactor);
          paintCanvas([], info);

          // Ensure ONNX session is ready before running segmentation
          await waitForOnnxSession();
          await runSegmentation(normalizationFactor, 'Running segmentation');
        } catch (err) {
          console.error(err);
          setErrorMessage(
            err instanceof Error ? err.message : 'Failed to process the provided GeoTIFF image.'
          );
        }
        return;
      }

      if (!model) {
        setErrorMessage('Model is not ready yet. Please wait and try again.');
        return;
      }

      setIsProcessing(true);
      try {
        const geoImage = await delineateUtils.loadGeoTiffRgb(file);
        geoImageRef.current = geoImage;
        fileNameRef.current = file.name;

        pendingPatchSizeRef.current = patchSize;
        await runDetectionsWithPatchSize(patchSize, 'Running inference');
        pendingPatchSizeRef.current = null;
      } catch (err) {
        console.error(err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to process the provided GeoTIFF image.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [model, normalizationFactor, patchSize, runDetectionsWithPatchSize, runSegmentation, selectedModel, paintCanvas, updateBaseImageData, waitForOnnxSession]
  );

  const handleRandomClick = useCallback(async () => {
    try {
      setProcessingStatus('Sampling random URL…');
      const url = await sampleRandomUrl();
      setProcessingStatus('Fetching sample GeoTIFF…');
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`Failed to fetch sample: ${resp.status}`);
      }
      const blob = await resp.blob();
      const file = new File([blob], url.split('/').pop() ?? 'sample.tif', { type: blob.type || 'image/tiff' });
      const label = parseFtwLabelFromUrl(url);
      setImageLabel(label ?? file.name);
      await processGeoTiffFile(file);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load random sample.');
    }
  }, [processGeoTiffFile, sampleRandomUrl, parseFtwLabelFromUrl]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';
    const lowerName = file.name.toLowerCase();
    const looksLikeTiff = lowerName.endsWith('.tif') || lowerName.endsWith('.tiff');
    const mime = file.type.toLowerCase();
    const mimeLooksLikeTiff = mime.includes('tif');
    if (!looksLikeTiff && !mimeLooksLikeTiff) {
      setErrorMessage('Please select a GeoTIFF file (.tif or .tiff).');
      return;
    }
    setImageLabel(file.name);
    await processGeoTiffFile(file);
  };

  return (
    <div className="min-h-screen bg-[#fdf1e4]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pb-16 pt-10 text-center">
        <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900/80">
          <Image
            src={bannerImage}
            alt="Aerial mosaic of agricultural fields"
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative flex flex-col gap-3 bg-gradient-to-r from-black/70 via-black/40 to-black/10 px-6 py-12 text-white sm:px-10 text-center">
            <h1 className="text-left text-3xl font-semibold md:text-4xl">Fields of the World (FTW) Demo</h1>
            <p className="max-w-2xl text-sm md:text-base">
              Upload a GeoTIFF from your own imagery to preview it instantly and let the browser
              highlight field boundaries for you. Pick a model, adjust the confidence sliders, and
              watch the detections update live&mdash;no installs required.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="max-h-[70vh] overflow-auto rounded border border-neutral-200 bg-neutral-900/5 p-2">
                <canvas
                  ref={canvasRef}
                  className="h-auto max-w-full"
                  style={{ width: '100%' }}
                />
              </div>
            </section>
          </div>

          <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            <div className="flex flex-col gap-2">
              <label
                className="text-left text-sm font-medium text-neutral-700"
                htmlFor="model-select"
              >
                Model Variant
              </label>
              <select
                id="model-select"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                disabled={isProcessing}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none"
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.precision ? ` · ${option.precision.toUpperCase()}` : ''}
                    {option.sizeHintMb ? ` · ~${option.sizeHintMb}MB` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                {MODEL_OPTIONS.find((m) => m.id === selectedModelId)?.description ??
                  'Select a model to download it from Hugging Face and cache it locally.'}
              </p>
            </div>
            <div className="flex flex-row flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { void handleRandomClick(); }}
                disabled={isProcessing || !model}
                className="whitespace-nowrap rounded-md border border-neutral-300 bg-neutral-900 px-3 py-1 text-xs text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Random Sample
              </button>
              <button
                type="button"
                onClick={() => { fileInputRef.current?.click(); }}
                disabled={(!model && !isSegmentation) || isProcessing}
                className="whitespace-nowrap rounded-md border border-neutral-300 bg-neutral-900 px-3 py-1 text-xs text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Upload GeoTIFF
              </button>
              <input
                ref={fileInputRef}
                id="tiff-upload"
                type="file"
                accept=".tif,.tiff"
                onChange={handleFileChange}
                disabled={(!model && !isSegmentation) || isProcessing}
                className="hidden"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {!isSegmentation && (
                <label className="flex flex-col gap-1 text-sm text-neutral-600">
                  <span className="flex items-center justify-between font-medium text-neutral-700">
                    Score Threshold
                    <span className="text-xs font-normal text-neutral-500">
                      {scoreThreshold.toFixed(2)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={scoreThreshold}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) {
                        return;
                      }
                      const clamped = clampUnit(next);
                      setScoreThreshold(clamped);
                    }}
                    className="w-full accent-neutral-700"
                  />
                </label>
              )}
              {!isSegmentation && (
                <label className="flex flex-col gap-1 text-sm text-neutral-600">
                  <span className="flex items-center justify-between font-medium text-neutral-700">
                    IoU NMS Threshold
                    <span className="text-xs font-normal text-neutral-500">
                      {iouThreshold.toFixed(2)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={iouThreshold}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) {
                        return;
                      }
                      setIouThreshold(clampUnit(next));
                    }}
                    className="w-full accent-neutral-700"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm text-neutral-600">
                <span className="flex items-center justify-between font-medium text-neutral-700">
                  Patch Size
                  <span className="text-xs font-normal text-neutral-500">
                    {patchSize}px
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={PATCH_MIN}
                    max={PATCH_MAX}
                    step={PATCH_STEP}
                    value={patchSize}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) {
                        return;
                      }
                      handlePatchSizeChange(next);
                    }}
                    className="h-1 flex-1 accent-neutral-700"
                  />
                </div>
              </label>
              {isSegmentation && (
                <label className="flex flex-col gap-1 text-sm text-neutral-600">
                  <span className="flex items-center justify-between font-medium text-neutral-700">
                    Mask Opacity
                    <span className="text-xs font-normal text-neutral-500">
                      {(maskOpacity * 100).toFixed(0)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={maskOpacity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) {
                        return;
                      }
                      const clamped = Math.max(0, Math.min(1, next));
                      setMaskOpacity(clamped);
                      window.requestAnimationFrame(() => {
                        void paintCanvas(detections);
                      });
                    }}
                    className="w-full accent-neutral-700"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm text-neutral-600 sm:col-span-2">
                <span className="flex items-center justify-between font-medium text-neutral-700">
                  Normalization Divisor
                  <span className="text-xs font-normal text-neutral-500">
                    {normalizationFactor.toLocaleString()}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={NORMALIZATION_MIN}
                    max={NORMALIZATION_MAX}
                    step={NORMALIZATION_STEP}
                    value={normalizationFactor}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) {
                        return;
                      }
                      handleNormalizationUpdate(next);
                    }}
                    className="h-1 flex-1 accent-neutral-700"
                  />
                </div>
                <span className="text-xs text-neutral-500">
                  Adjust brightness of pixel values for inference
                </span>
              </label>
            </div>
            <div className="grid gap-2 text-sm text-neutral-600">
              <span>
                <span className="font-medium text-neutral-700">Model Status:</span> {modelStatus}
              </span>
              <span>
                <span className="font-medium text-neutral-700">Inference Backend:</span> {backendName}
                {backendError ? ` (${backendError})` : ''}
              </span>
              {processingStatus && (
                <span>
                  <span className="font-medium text-neutral-700">Processing:</span> {processingStatus}
                </span>
              )}
              {imageInfo && (
                <>
                  <span>
                    <span className="font-medium text-neutral-700">Image:</span> {imageLabel ?? imageInfo.fileName}
                  </span>
                  <span>
                    <span className="font-medium text-neutral-700">Size:</span> {imageInfo.width} &times; {imageInfo.height}px &middot;{' '}
                    {imageInfo.patchCount} full patches
                  </span>
                </>
              )}
              {/* Active thresholds removed per request */}
              {/* Mask Pixels removed per request */}
              {!isSegmentation && <span>Raw detections: {rawDetectionCount}</span>}
              {!isSegmentation && <span>Detections after NMS: {detections.length}</span>}
            </div>
            {errorMessage && (
              <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
