'use client';

export interface ClassMetadata {
  v4_Code: string;
  v5_Code: string;
  commonName: string; // This is the "Sound" column
  category: string;
  subcategory: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  scientificName: string;
}

// This will be populated lazily from the CSV
let CLASS_MAPPINGS: Record<string, ClassMetadata> | null = null;

// Load and parse the CSV file
async function loadClassMappings(): Promise<Record<string, ClassMetadata>> {
  if (CLASS_MAPPINGS !== null) {
    return CLASS_MAPPINGS;
  }

  try {
    const response = await fetch('/bioacoustics/assets/target_classes.csv');
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    const mappings: Record<string, ClassMetadata> = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length < 11) continue;
      
      const v5_Code = values[1].trim();
      if (!v5_Code || v5_Code === 'NA') continue;
      
      mappings[v5_Code] = {
        v4_Code: values[0].trim(),
        v5_Code: v5_Code,
        commonName: values[2].trim(),
        category: values[3].trim(),
        subcategory: values[4].trim(),
        class: values[5].trim(),
        order: values[6].trim(),
        family: values[7].trim(),
        genus: values[8].trim(),
        species: values[9].trim(),
        scientificName: values[10].trim(),
      };
    }
    
    CLASS_MAPPINGS = mappings;
    return mappings;
  } catch (error) {
    console.error('Failed to load class mappings:', error);
    return {};
  }
}

async function getClassMetadata(v5Code: string): Promise<ClassMetadata | null> {
  const mappings = await loadClassMappings();
  return mappings[v5Code] ?? null;
}

export async function getHumanReadableName(v5Code: string): Promise<string> {
  const metadata = await getClassMetadata(v5Code);
  return metadata?.commonName ?? v5Code;
}

export function getClassThumbnail(v5Code: string): string | null {
  // All thumbnails now follow the <v5_Code>.jpg naming convention
  if (v5Code && v5Code !== '' && v5Code !== 'NA') {
    return `/bioacoustics/assets/thumbnails/${v5Code}.jpg`;
  }
  return null;
}