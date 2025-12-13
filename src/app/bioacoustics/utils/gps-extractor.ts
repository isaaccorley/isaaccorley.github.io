/**
 * GPS Coordinate Extractor for Audio Files
 * 
 * This utility safely extracts GPS coordinates from audio file metadata
 * using the music-metadata library.
 */

import { parseBlob } from 'music-metadata';

export interface GPSCoordinates {
  lat: number;
  lon: number;
  name?: string;
}

/**
 * Attempts to extract GPS coordinates from audio file metadata
 * Returns null if coordinates cannot be extracted
 */
export async function extractGPSFromAudio(file: File): Promise<GPSCoordinates | null> {
  try {
    // Parse audio metadata using music-metadata library
    const metadata = await parseBlob(file);
    
    // Check for GPS coordinates in native tags
    const native = metadata.native;
    if (native) {
      // Try to find GPS data in various tag formats
      for (const tags of Object.values(native)) {
        for (const tag of tags) {
          // Check for GPS-related tags
          if (tag.id.toLowerCase().includes('gps') || 
              tag.id.toLowerCase().includes('location') ||
              tag.id.toLowerCase().includes('geo') ||
              tag.id.toLowerCase().includes('coord') ||
              tag.id.toLowerCase().includes('lat') ||
              tag.id.toLowerCase().includes('lon') ||
              tag.id.toLowerCase().includes('position')) {
            // Try to parse the value
            const coords = parseGPSValue(tag.value);
            if (coords) {
              return coords;
            }
          }
        }
      }
    }
    
    // Check common metadata fields
    const common = metadata.common;
    if (common) {
      // Some formats store location in comment or description
      const textFields = [common.comment, common.description, common.title].filter(Boolean);
      for (const text of textFields) {
        if (Array.isArray(text)) {
          for (const item of text) {
            const coords = parseGPSFromText(String(item));
            if (coords) {
              return coords;
            }
          }
        } else if (typeof text === 'string') {
          const coords = parseGPSFromText(text);
          if (coords) {
            return coords;
          }
        }
      }
    }
    
    // Try to extract from filename as last resort
    // Some field recorders encode GPS in filename like: "recording_lat40.7128_lon-74.0060.wav"
    const filenameCoords = parseGPSFromText(file.name);
    if (filenameCoords) {
      return filenameCoords;
    }
    
    return null;
  } catch (error) {
    console.warn('[GPS Extract] Extraction failed:', error);
    return null;
  }
}

/**
 * Helper function to parse GPS value from metadata tag
 */
function parseGPSValue(value: unknown): GPSCoordinates | null {
  if (typeof value === 'string') {
    return parseGPSFromText(value);
  }
  
  // Handle structured GPS data (e.g., from EXIF-like tags)
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    
    // Check for lat/lon properties
    if ('lat' in obj && 'lon' in obj) {
      const lat = typeof obj.lat === 'number' ? obj.lat : parseFloat(String(obj.lat));
      const lon = typeof obj.lon === 'number' ? obj.lon : parseFloat(String(obj.lon));
      
      if (isValidLatLon(lat, lon)) {
        return { lat, lon };
      }
    }
    
    // Check for latitude/longitude properties
    if ('latitude' in obj && 'longitude' in obj) {
      const lat = typeof obj.latitude === 'number' ? obj.latitude : parseFloat(String(obj.latitude));
      const lon = typeof obj.longitude === 'number' ? obj.longitude : parseFloat(String(obj.longitude));
      
      if (isValidLatLon(lat, lon)) {
        return { lat, lon };
      }
    }
  }
  
  return null;
}

/**
 * Parses GPS coordinates from text strings
 * Supports various formats:
 * - Decimal: "40.7128, -74.0060"
 * - DMS: "40°42'46"N 74°0'21"W"
 * - Named format: "lat:40.7128,lon:-74.0060"
 * - Filename format: "recording_lat40.7128_lon-74.0060.wav"
 * - Underscore format: "lat_40.7128_lon_-74.0060"
 */
function parseGPSFromText(text: string): GPSCoordinates | null {
  // Pattern 1: Named with colon - "lat:40.7128,lon:-74.0060" or "lat:40.7128 lon:-74.0060"
  let pattern = /lat:?\s*(-?\d+\.?\d*)[,\s]+lon:?\s*(-?\d+\.?\d*)/i;
  let match = text.match(pattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (isValidLatLon(lat, lon)) {
      return { lat, lon };
    }
  }
  
  // Pattern 2: Filename format - "lat47.6062_lon-122.3321" (no separator after lat/lon)
  pattern = /lat(-?\d+\.?\d*)_lon(-?\d+\.?\d*)/i;
  match = text.match(pattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (isValidLatLon(lat, lon)) {
      return { lat, lon };
    }
  }
  
  // Pattern 3: Underscore format - "lat_40.7128_lon_-74.0060"
  pattern = /lat_(-?\d+\.?\d*)_lon_(-?\d+\.?\d*)/i;
  match = text.match(pattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (isValidLatLon(lat, lon)) {
      return { lat, lon };
    }
  }
  
  // Pattern 4: Latitude/Longitude full words
  pattern = /latitude:?\s*(-?\d+\.?\d*)[,\s]+longitude:?\s*(-?\d+\.?\d*)/i;
  match = text.match(pattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (isValidLatLon(lat, lon)) {
      return { lat, lon };
    }
  }
  
  // Pattern 5: Simple decimal pair - "40.7128, -74.0060" or "40.7128,-74.0060"
  // Only match if numbers look like coordinates (reasonable lat/lon range)
  pattern = /(-?\d+\.\d{4,})[,\s]+(-?\d+\.\d{4,})/;
  match = text.match(pattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (isValidLatLon(lat, lon)) {
      return { lat, lon };
    }
  }
  
  // Pattern 6: DMS format - "40°42'46"N 74°0'21"W"
  const dmsPattern = /(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/i;
  const dmsMatch = text.match(dmsPattern);
  
  if (dmsMatch) {
    const lat = convertDMSToDecimal(
      parseInt(dmsMatch[1]),
      parseInt(dmsMatch[2]),
      parseFloat(dmsMatch[3]),
      dmsMatch[4]
    );
    const lon = convertDMSToDecimal(
      parseInt(dmsMatch[5]),
      parseInt(dmsMatch[6]),
      parseFloat(dmsMatch[7]),
      dmsMatch[8]
    );
    
    if (isValidLatLon(lat, lon)) {
      return { lat, lon };
    }
  }
  
  return null;
}

/**
 * Converts GPS coordinates from degrees/minutes/seconds to decimal degrees
 */
function convertDMSToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: string
): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return decimal;
}

/**
 * Validates latitude and longitude values
 */
function isValidLatLon(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}
