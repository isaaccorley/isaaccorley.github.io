'use client';

import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { getHumanReadableName } from './class-mapper';

// These are the v5_Code values from the target_classes.csv
export const CLASSES = [
  'ACGE1', 'ACGE2', 'ACCO1', 'ACST1', 'BUJA1', 'BUJA2', 'HALE1', 'PAHA1', 'Raptor',
  'BRCA1', 'CHMI1', 'CHMI2', 'PHNU1', 'BRMA1', 'BRMA2', 'GADE1', 'PAFA1', 'PAFA2',
  'STDE1', 'ZEMA1', 'FACO1', 'FASP1', 'BOUM1', 'CACA1', 'DEFU1', 'DEFU2', 'MEGA1',
  'ORPI1', 'ORPI2', 'ANCA1', 'PHME1', 'PILU1', 'PILU2', 'COBR1', 'COCO1', 'CYST1',
  'CYST2', 'NUCO1', 'PECA1', 'HAPU1', 'HEVE1', 'LOCU1', 'SPPI1', 'CHFA1', 'CAPU1',
  'LECE1', 'POEC1', 'POEC2', 'JUHY1', 'PIMA1', 'PIMA2', 'SPPA1', 'ZOLE1', 'SITT1',
  'SITT2', 'TRAE1', 'CAGU1', 'CAGU2', 'CAGU3', 'CAUS1', 'CAUS2', 'IXNA1', 'IXNA2',
  'MYTO1', 'SICU1', 'TUMI1', 'TUMI2', 'CCOO1', 'CCOO2', 'COSO1', 'EMDI1', 'EMOB1',
  'VIHU1', 'COAU1', 'COAU2', 'DRPU1', 'HYPI1', 'LEAL1', 'LEVI1', 'LEVI2', 'MEFO1',
  'SPHY1', 'SPHY2', 'SPTH1', 'Drum', 'AEAC1', 'AEAC2', 'ASOT1', 'BUVI1', 'BUVI2',
  'GLGN1', 'MEKE1', 'MEKE2', 'MEKE3', 'PSFL1', 'STNE1', 'STNE2', 'STOC_4Note',
  'STOC_Series', 'Strix_Bark', 'Strix_Whistle', 'STVA_8Note', 'STVA_Insp', 'STVA_Series',
  'CECA1', 'CALA1', 'CALU1', 'ODOC1', 'OCPR1', 'TAMI1', 'TADO1', 'TADO2', 'URAM1',
  'Bullfrog', 'Frog', 'Fly', 'Chicken', 'Cow', 'Creek', 'Dog', 'Rain', 'Thunder',
  'Tree', 'Cricket', 'Airplane', 'Chainsaw', 'Growler', 'Gunshot', 'Highway', 'Horn',
  'Human', 'Survey_Tone', 'Train', 'Yarder',
];

export interface ClassificationResult {
  className: string;
  humanReadableName?: string;
  confidence: number;
  classIndex: number;
  meanConfidence?: number;
  maxConfidence?: number;
}

export interface InferenceResult {
  topPredictions: ClassificationResult[];
  allPredictions: ClassificationResult[];
  clipIndex?: number;
}

export interface BatchInferenceResult {
  results: InferenceResult[];
  totalClips: number;
}

const DETECTION_THRESHOLD = 0.5;

export async function classifySpectrogram(
  session: InferenceSession,
  imageData: ImageData
): Promise<InferenceResult> {
  const ort = await import('onnxruntime-web');
  
  if (imageData.width !== 1000 || imageData.height !== 257) {
    throw new Error(`Expected spectrogram size 1000x257, got ${imageData.width}x${imageData.height}`);
  }
  
  const pixelData = imageData.data;
  const grayscaleData = new Float32Array(imageData.width * imageData.height);
  
  for (let i = 0; i < grayscaleData.length; i++) {
    grayscaleData[i] = pixelData[i * 4] / 255.0;
  }


  
  const tensorShape = [1, imageData.height, imageData.width, 1];
  const tensor = new ort.Tensor('float32', grayscaleData, tensorShape);
  
  if (!session.inputNames || session.inputNames.length === 0) {
    throw new Error('ONNX session has no input names');
  }
  
  const feeds: Record<string, Tensor> = {};
  feeds[session.inputNames[0]] = tensor;
  
  const outputs = await session.run(feeds);
  
  const outputNames = session.outputNames ?? Object.keys(outputs);
  const outputTensor = outputs[outputNames[0]];
  
  if (!outputTensor) {
    throw new Error('Model returned no outputs');
  }
  
  const logits = outputTensor.data as Float32Array | Float64Array | number[];
  
  const sigmoidProbs = sigmoid(Array.from(logits).map(v => Number(v)));
  
  const predictions: ClassificationResult[] = await Promise.all(
    sigmoidProbs.map(async (prob, idx) => {
      const className = CLASSES[idx] ?? `Class_${idx}`;
      const humanReadableName = await getHumanReadableName(className);
      return {
        className,
        humanReadableName,
        confidence: prob,
        classIndex: idx,
      };
    })
  );
  
  predictions.sort((a, b) => b.confidence - a.confidence);
  
  const passing = predictions.filter((p) => p.confidence >= DETECTION_THRESHOLD);
  const topPredictions =
    passing.length > 0
      ? passing.slice(0, 5)
      : [
          {
            className: 'none',
            humanReadableName: 'None detected',
            confidence: 1 - (Math.max(...sigmoidProbs) || 0),
            classIndex: -1,
          },
        ];

  return {
    topPredictions,
    allPredictions: passing.length > 0 ? predictions : topPredictions,
  };
}

export async function classifySpectrogramsBatch(
  session: InferenceSession,
  spectrograms: ImageData[],
  onProgress?: (current: number, total: number) => void
): Promise<BatchInferenceResult> {
  const results: InferenceResult[] = [];
  
  for (let i = 0; i < spectrograms.length; i++) {
    if (onProgress) {
      onProgress(i + 1, spectrograms.length);
    }
    
    const result = await classifySpectrogram(session, spectrograms[i]);
    result.clipIndex = i;
    results.push(result);
  }
  
  return {
    results,
    totalClips: spectrograms.length,
  };
}

function sigmoid(logits: number[]): number[] {
  return logits.map(x => 1 / (1 + Math.exp(-x)));
}

