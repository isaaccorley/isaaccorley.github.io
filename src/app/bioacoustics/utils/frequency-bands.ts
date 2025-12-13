/**
 * Calculate frequency band energies from spectrogram ImageData
 * 
 * Three frequency ranges of ecological interest:
 * - Geophony (< 1 kHz): Wind, rain, flowing water
 * - Anthrophony (1-2 kHz): Human machinery, cars, airplanes
 * - Biophony (2-8 kHz, capped at 4 kHz): Bird songs and calls
 */

export interface FrequencyBandEnergies {
  geophony: number;      // < 1 kHz
  anthrophony: number;   // 1-2 kHz
  biophony: number;      // 2-4 kHz (capped by sample rate)
}

/**
 * Get row index for a given frequency
 */
function getRowForFrequency(freq: number, height: number, maxFreq: number = 4000): number {
  return Math.round((freq / maxFreq) * (height - 1));
}

/**
 * Calculate energy in a frequency band
 */
function calculateBandEnergy(
  imageData: ImageData,
  startFreq: number,
  endFreq: number,
  maxFreq: number = 4000
): number {
  const { width, height, data } = imageData;
  
  const startRow = getRowForFrequency(startFreq, height, maxFreq);
  const endRow = getRowForFrequency(endFreq, height, maxFreq);
  
  let totalEnergy = 0;
  let count = 0;
  
  for (let y = startRow; y <= endRow && y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Normalize to 0-1 range (R, G, B are the same in grayscale)
      totalEnergy += data[idx] / 255.0;
      count++;
    }
  }
  
  // Return average energy (normalized by bin count)
  return count > 0 ? totalEnergy / count : 0;
}

/**
 * Calculate frequency band energies for ecological analysis
 */
export function calculateFrequencyBands(
  imageData: ImageData,
  maxFrequency: number = 4000
): FrequencyBandEnergies {
  return {
    geophony: calculateBandEnergy(imageData, 0, 1000, maxFrequency),
    anthrophony: calculateBandEnergy(imageData, 1000, 2000, maxFrequency),
    biophony: calculateBandEnergy(imageData, 2000, maxFrequency, maxFrequency),
  };
}
