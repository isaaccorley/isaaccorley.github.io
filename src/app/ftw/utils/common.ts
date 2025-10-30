import * as tf from "@tensorflow/tfjs";

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

export function extractPatches(
  image: GeoImage,
  patchSize: number,
  channels: number
): Patch[] {
  const patches: Patch[] = [];
  let patchIndex = 0;

  for (let y = 0; y < image.height; y += patchSize) {
    for (let x = 0; x < image.width; x += patchSize) {
      const patchBuffer = new Float32Array(patchSize * patchSize * channels);
      for (let py = 0; py < patchSize; py += 1) {
        const sourceRow = y + py;
        const targetOffset = py * patchSize * channels;
        if (sourceRow >= image.height) {
          continue;
        }
        const sourceRowOffset = sourceRow * image.width * image.channels;
        for (let px = 0; px < patchSize; px += 1) {
          const sourceCol = x + px;
          const targetIndex = targetOffset + px * channels;
          if (sourceCol >= image.width) {
            continue;
          }
          const sourceIndex = sourceRowOffset + sourceCol * image.channels;
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

export function upsamplePatch(
  data: Float32Array,
  width: number,
  height: number,
  scaleFactor: number = 2
): { data: Float32Array; width: number; height: number } {
  const channels = 4;
  const newWidth = Math.round(width * scaleFactor);
  const newHeight = Math.round(height * scaleFactor);
  const tensor = tf.tensor(data, [height, width, channels], "float32");
  const resized = tf.image.resizeBilinear(
    tensor as tf.Tensor3D,
    [newHeight, newWidth],
    true
  );
  const upsampledData = resized.dataSync() as Float32Array;
  tensor.dispose();
  resized.dispose();
  return { data: upsampledData, width: newWidth, height: newHeight };
}


