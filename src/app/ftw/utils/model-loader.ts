'use client';

import * as tf from '@tensorflow/tfjs';
import JSZip from 'jszip';
import type { InferenceSession } from 'onnxruntime-web';
import { createFieldOnnxSession } from './ftw';

export type ModelOption = {
  id: string;
  name: string;
  engine: 'tfjs' | 'onnx';
  url: string;
  classes?: string[];
  palette?: string[];
  description?: string;
  precision?: 'fp16' | 'fp32';
  sizeHintMb?: number;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'delineateanything-fp16',
    name: 'DelineateAnything',
    engine: 'tfjs',
    url: 'https://hf.co/isaaccorley/delineate-anything-tensorflowjs/resolve/main/DelineateAnything_fp16_web_model.zip',
    precision: 'fp16',
    description: 'Standard model variant with FP16 weights.',
    sizeHintMb: 18,
  },
  {
    id: 'delineateanything-fp32',
    name: 'DelineateAnything',
    engine: 'tfjs',
    url: 'https://hf.co/isaaccorley/delineate-anything-tensorflowjs/resolve/main/DelineateAnything_fp32_web_model.zip',
    precision: 'fp32',
    description: 'Standard model variant with FP32 weights.',
    sizeHintMb: 33,
  },
  {
    id: 'delineateanything-s-fp16',
    name: 'DelineateAnything-S',
    engine: 'tfjs',
    url: 'https://hf.co/isaaccorley/delineate-anything-tensorflowjs/resolve/main/DelineateAnything-S_fp16_web_model.zip',
    precision: 'fp16',
    description: 'Smaller YOLO11-S segmentation graph; FP16 weights.',
    sizeHintMb: 6,
  },
  {
    id: 'delineateanything-s-fp32',
    name: 'DelineateAnything-S',
    engine: 'tfjs',
    url: 'https://hf.co/isaaccorley/delineate-anything-tensorflowjs/resolve/main/DelineateAnything-S_fp32_web_model.zip',
    precision: 'fp32',
    description: 'YOLO11-S segmentation graph with FP32 weights.',
    sizeHintMb: 10,
  },
  // {
  //   id: 'ftw-unet-fp16',
  //   name: 'FTW v2 UNet',
  //   engine: 'onnx',
  //   url: 'https://hf.co/isaaccorley/ftw-v2-onnx/resolve/main/ftw-v2-single-window-unet-efficientnetb3-fp16.onnx',
  //   precision: 'fp16',
  //   description: 'Fields of the World semantic segmentation (RGBN) UNet, FP16 weights.',
  //   sizeHintMb: 27,
  //   classes: ['background', 'field','field_boundary'],
  //   palette: ['#000000', '#00FF00','#FF0000'],
  // },
  {
    id: 'ftw-unet-fp32',
    name: 'FTW v2 UNet',
    engine: 'onnx',
    url: 'https://hf.co/isaaccorley/ftw-v2-onnx/resolve/main/ftw-v2-single-window-unet-efficientnetb3-fp32.onnx',
    precision: 'fp32',
    description: 'Fields of the World semantic segmentation (RGBN) UNet, FP32 weights.',
    sizeHintMb: 52,
    classes: ['background', 'field', 'field_boundary'],
    palette: ['#000000', '#00FF00','#FF0000'],
  },
];

type CachedFile = {
  name: string;
  buffer: ArrayBuffer;
  type: string;
};

const ZIP_MEMORY_CACHE = new Map<string, ArrayBuffer>();
const FILE_MEMORY_CACHE = new Map<string, CachedFile[]>();
const CACHE_NAME = 'delineate-anything-models';

async function fetchZipWithCache(url: string): Promise<ArrayBuffer> {
  if (ZIP_MEMORY_CACHE.has(url)) {
    return ZIP_MEMORY_CACHE.get(url) as ArrayBuffer;
  }

  const hasCacheApi = typeof caches !== 'undefined';
  const cacheStore = hasCacheApi ? await caches.open(CACHE_NAME) : null;

  if (cacheStore) {
    const cachedResponse = await cacheStore.match(url);
    if (cachedResponse) {
      const cachedBuffer = await cachedResponse.arrayBuffer();
      ZIP_MEMORY_CACHE.set(url, cachedBuffer);
      return cachedBuffer;
    }
  }

  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch model archive: ${response.status} ${response.statusText}`
    );
  }

  const buffer = await response.arrayBuffer();
  ZIP_MEMORY_CACHE.set(url, buffer);

  if (cacheStore) {
    const clonedBuffer = buffer.slice(0);
    const cached = new Response(clonedBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(clonedBuffer.byteLength),
      },
    });
    await cacheStore.put(url, cached);
  }

  return buffer;
}

async function unzipModelFiles(url: string): Promise<CachedFile[]> {
  if (FILE_MEMORY_CACHE.has(url)) {
    return FILE_MEMORY_CACHE.get(url) as CachedFile[];
  }

  const zipBuffer = await fetchZipWithCache(url);
  const zip = await JSZip.loadAsync(zipBuffer);

  const fileEntries = (
    await Promise.all(
      Object.values(zip.files)
        .filter((file) => !file.dir)
        .map(async (file) => {
          const baseName = file.name.split('/').pop() ?? file.name;
          const lower = baseName.toLowerCase();
          if (!lower.endsWith('.json') && !lower.endsWith('.bin')) {
            return null;
          }
          const type = lower.endsWith('.json')
            ? 'application/json'
            : 'application/octet-stream';
          const buffer = await file.async('arraybuffer');
          return {
            name: baseName,
            buffer,
            type,
          };
        })
    )
  ).filter((entry): entry is CachedFile => Boolean(entry));

  if (!fileEntries.some((entry) => entry.name.endsWith('.json'))) {
    throw new Error('Model archive is missing model.json');
  }

  FILE_MEMORY_CACHE.set(url, fileEntries);
  return fileEntries;
}

async function createFileCopies(entries: CachedFile[]): Promise<File[]> {
  return entries
    .map(
      (entry) =>
        new File([entry.buffer.slice(0)], entry.name, {
          type: entry.type,
        })
    )
    .sort((a, b) => {
      if (a.name.endsWith('.json')) {
        return -1;
      }
      if (b.name.endsWith('.json')) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
}

export async function loadModelFromOption(option: ModelOption): Promise<tf.GraphModel | InferenceSession> {
  if (option.engine === 'onnx') {
    return loadOnnxModelFromOption(option);
  }
  
  await tf.ready();
  const cachedEntries = await unzipModelFiles(option.url);
  const files = await createFileCopies(cachedEntries);
  return tf.loadGraphModel(tf.io.browserFiles(files));
}

async function loadOnnxModelFromOption(option: ModelOption): Promise<InferenceSession> {
  try {
    console.log('Loading ONNX model:', option.name, 'from URL:', option.url);
    
    // Download the ONNX file directly
    const response = await fetch(option.url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download ONNX model: ${response.status} ${response.statusText}`);
    }
    
    const modelBuffer = await response.arrayBuffer();
    console.log('Downloaded ONNX model size:', modelBuffer.byteLength);
    
    // Validate the model buffer
    if (modelBuffer.byteLength < 100) {
      throw new Error('Model file appears to be too small or corrupted');
    }
    
    console.log('Creating ONNX session...');
    const session = await createFieldOnnxSession({
      modelPath: modelBuffer,
      executionProviders: ['webgpu', 'webgl', 'wasm'],
      logSeverityLevel: 3, // Error level only to suppress warnings
    });
    
    console.log('ONNX session created successfully');
    return session;
  } catch (error) {
    console.error('Error in loadOnnxModelFromOption:', error);
    console.error('Model option:', option);
    
    // Handle ONNX Runtime specific error codes
    if (typeof error === 'number') {
      const errorMessages: Record<number, string> = {
        15002192: 'ONNX Runtime Error: Invalid model format or corrupted model file',
        15002193: 'ONNX Runtime Error: Model version not supported',
        15002194: 'ONNX Runtime Error: Model input/output mismatch',
        15002195: 'ONNX Runtime Error: Model execution failed',
        15002196: 'ONNX Runtime Error: Memory allocation failed',
        15002197: 'ONNX Runtime Error: Invalid execution provider',
        15002198: 'ONNX Runtime Error: Model optimization failed',
      };
      
      const errorMessage = errorMessages[error] || `ONNX Runtime Error Code: ${error}`;
      throw new Error(`${errorMessage}. This usually indicates a problem with the model file format or compatibility.`);
    }
    
    throw error;
  }
}
