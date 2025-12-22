/**
 * Calculate acoustic indices from spectrogram ImageData
 *
 * Spectrogram format:
 * - width: 1000 time bins (12 seconds)
 * - height: 257 frequency bins (0-4 kHz @ 8 kHz sample rate)
 * - data: Uint8ClampedArray RGBA pixels (grayscale, 0-255)
 * - Each pixel: [R, G, B, A] where R=G=B=magnitude
 */

export interface AcousticIndices {
  aci: number; // Acoustic Complexity Index
  adi: number; // Acoustic Diversity Index
  ndsi: number; // Normalized Difference Soundscape Index
  bi: number; // Bioacoustic Index
}

/**
 * Extract magnitude values from ImageData (grayscale spectrograms have R=G=B)
 */
function extractMagnitudes(imageData: ImageData): number[][] {
  const { width, height, data } = imageData;
  const magnitudes: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Normalize to 0-1 range
      row.push(data[idx] / 255.0);
    }
    magnitudes.push(row);
  }

  return magnitudes;
}

/**
 * Get row index for a given frequency
 */
function getRowForFrequency(freq: number, height: number, maxFreq: number = 4000): number {
  return Math.round((freq / maxFreq) * (height - 1));
}

/**
 * Calculate ACI (Acoustic Complexity Index)
 * Measures the variability of intensity in sound over time
 * Higher values indicate more complex soundscapes (bird activity)
 */
function calculateACI(magnitudes: number[][]): number {
  const height = magnitudes.length;
  const width = magnitudes[0].length;

  let totalDifference = 0;

  for (let y = 0; y < height; y++) {
    let rowDifference = 0;
    let rowIntensity = 0;

    for (let x = 0; x < width - 1; x++) {
      const current = magnitudes[y][x];
      const next = magnitudes[y][x + 1];
      rowDifference += Math.abs(current - next);
      rowIntensity += current;
    }
    rowIntensity += magnitudes[y][width - 1];

    if (rowIntensity > 0) {
      totalDifference += rowDifference / rowIntensity;
    }
  }

  return totalDifference;
}

/**
 * Calculate ADI (Acoustic Diversity Index)
 * Shannon entropy across frequency bins
 * Higher values indicate more even distribution of sound energy across frequencies
 */
function calculateADI(magnitudes: number[][], numBins: number = 10): number {
  const height = magnitudes.length;
  const width = magnitudes[0].length;

  // Divide frequency range into bins
  const binSize = Math.floor(height / numBins);
  const binEnergies: number[] = new Array(numBins).fill(0);

  // Sum energy in each frequency bin
  for (let bin = 0; bin < numBins; bin++) {
    const startRow = bin * binSize;
    const endRow = bin === numBins - 1 ? height : (bin + 1) * binSize;

    for (let y = startRow; y < endRow; y++) {
      for (let x = 0; x < width; x++) {
        binEnergies[bin] += magnitudes[y][x];
      }
    }
  }

  // Calculate total energy
  const totalEnergy = binEnergies.reduce((sum, e) => sum + e, 0);

  if (totalEnergy === 0) {
    return 0;
  }

  // Calculate Shannon entropy
  let entropy = 0;
  for (let bin = 0; bin < numBins; bin++) {
    if (binEnergies[bin] > 0) {
      const proportion = binEnergies[bin] / totalEnergy;
      entropy -= proportion * Math.log(proportion);
    }
  }

  // Normalize by maximum possible entropy (log of number of bins)
  const maxEntropy = Math.log(numBins);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Calculate NDSI (Normalized Difference Soundscape Index)
 * Ratio of biological sounds to human-made sounds
 * Range: -1 (all anthrophony) to +1 (all biophony)
 */
function calculateNDSI(magnitudes: number[][], height: number, maxFreq: number = 4000): number {
  const width = magnitudes[0].length;

  // Define frequency ranges
  const anthroStart = getRowForFrequency(1000, height, maxFreq); // 1 kHz
  const anthroEnd = getRowForFrequency(2000, height, maxFreq); // 2 kHz
  const bioStart = getRowForFrequency(2000, height, maxFreq); // 2 kHz
  const bioEnd = getRowForFrequency(4000, height, maxFreq); // 4 kHz (max available)

  let anthrophonyEnergy = 0;
  let biophonyEnergy = 0;

  // Sum anthrophony energy (1-2 kHz)
  for (let y = anthroStart; y <= anthroEnd && y < height; y++) {
    for (let x = 0; x < width; x++) {
      anthrophonyEnergy += magnitudes[y][x];
    }
  }

  // Sum biophony energy (2-4 kHz, limited by sample rate)
  for (let y = bioStart; y <= bioEnd && y < height; y++) {
    for (let x = 0; x < width; x++) {
      biophonyEnergy += magnitudes[y][x];
    }
  }

  const total = anthrophonyEnergy + biophonyEnergy;
  if (total === 0) {
    return 0;
  }

  return (biophonyEnergy - anthrophonyEnergy) / total;
}

/**
 * Calculate BI (Bioacoustic Index)
 * Total sound energy in bird frequency range (2-8 kHz)
 * Capped at 4 kHz due to 8 kHz sample rate
 * Higher values suggest more bird activity
 */
function calculateBI(magnitudes: number[][], height: number, maxFreq: number = 4000): number {
  const width = magnitudes[0].length;

  // Bird frequency range: 2-4 kHz (limited by sample rate)
  const bioStart = getRowForFrequency(2000, height, maxFreq);
  const bioEnd = getRowForFrequency(4000, height, maxFreq);

  let totalEnergy = 0;

  for (let y = bioStart; y <= bioEnd && y < height; y++) {
    for (let x = 0; x < width; x++) {
      totalEnergy += magnitudes[y][x];
    }
  }

  // Normalize by the number of bins
  const numBins = (bioEnd - bioStart + 1) * width;
  return numBins > 0 ? totalEnergy / numBins : 0;
}

/**
 * Calculate all acoustic indices for a spectrogram
 */
export function calculateAcousticIndices(
  imageData: ImageData,
  maxFrequency: number = 4000,
): AcousticIndices {
  const magnitudes = extractMagnitudes(imageData);
  const height = imageData.height;

  return {
    aci: calculateACI(magnitudes),
    adi: calculateADI(magnitudes, 10),
    ndsi: calculateNDSI(magnitudes, height, maxFrequency),
    bi: calculateBI(magnitudes, height, maxFrequency),
  };
}
