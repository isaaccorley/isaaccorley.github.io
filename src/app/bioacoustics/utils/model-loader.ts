"use client";

import type { InferenceSession } from "onnxruntime-web";

type OrtModule = typeof import("onnxruntime-web");

let ortModulePromise: Promise<OrtModule> | null = null;

const getOrtModule = (): Promise<OrtModule> => {
  if (!ortModulePromise) {
    ortModulePromise = (async () => {
      const ort = await import("onnxruntime-web");

      try {
        if (ort.env && typeof ort.env.logLevel !== "undefined") {
          ort.env.logLevel = "error";
        }
        if (ort.env && typeof ort.env.logSeverityLevel !== "undefined") {
          ort.env.logSeverityLevel = 3;
        }
        if (ort.env && typeof ort.env.verbose !== "undefined") {
          ort.env.verbose = false;
        }
      } catch (e) {
        console.warn("Could not set ONNX Runtime log level:", e);
      }

      return ort;
    })();
  }
  return ortModulePromise;
};

const MODEL_CACHE = new Map<string, InferenceSession>();
const MODEL_BUFFER_CACHE = new Map<string, ArrayBuffer>();
const CACHE_NAME = "bioacoustics-models";

async function fetchModelWithCache(url: string): Promise<ArrayBuffer> {
  if (MODEL_BUFFER_CACHE.has(url)) {
    return MODEL_BUFFER_CACHE.get(url)!;
  }

  const hasCacheApi = typeof caches !== "undefined";
  const cacheStore = hasCacheApi ? await caches.open(CACHE_NAME) : null;

  if (cacheStore) {
    const cachedResponse = await cacheStore.match(url);
    if (cachedResponse) {
      const cachedBuffer = await cachedResponse.arrayBuffer();
      MODEL_BUFFER_CACHE.set(url, cachedBuffer);
      return cachedBuffer;
    }
  }

  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  MODEL_BUFFER_CACHE.set(url, buffer);

  if (cacheStore) {
    const clonedBuffer = buffer.slice(0);
    const cached = new Response(clonedBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(clonedBuffer.byteLength),
      },
    });
    await cacheStore.put(url, cached);
  }

  return buffer;
}

export function detectExecutionProviders(): string[] {
  const providers: string[] = [];

  if (typeof navigator !== "undefined") {
    if ("gpu" in navigator) {
      providers.push("webgpu");
    }

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      providers.push("webgl");
    }
  }

  providers.push("wasm");

  return providers;
}

export async function loadBioacousticsModel(
  modelPath: string | ArrayBuffer,
): Promise<InferenceSession> {
  const cacheKey = typeof modelPath === "string" ? modelPath : "buffer";

  if (MODEL_CACHE.has(cacheKey)) {
    return MODEL_CACHE.get(cacheKey)!;
  }

  const ort = await getOrtModule();

  const executionProviders = detectExecutionProviders();

  const sessionOptions = {
    executionProviders: executionProviders as readonly ("webgpu" | "webgl" | "wasm")[],
    logSeverityLevel: 3 as const,
    enableCpuMemArena: true,
    enableMemPattern: true,
  };

  let session: InferenceSession;
  if (typeof modelPath === "string") {
    const modelBuffer = await fetchModelWithCache(modelPath);
    session = await ort.InferenceSession.create(new Uint8Array(modelBuffer), sessionOptions);
  } else {
    session = await ort.InferenceSession.create(new Uint8Array(modelPath), sessionOptions);
  }

  MODEL_CACHE.set(cacheKey, session);
  return session;
}
