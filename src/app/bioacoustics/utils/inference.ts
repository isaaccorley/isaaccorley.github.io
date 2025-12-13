'use client';

import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { getHumanReadableName } from './class-mapper';

// These are the v5_Code values from the target_classes.csv
export const CLASSES = [
  'ACCO1', 'ACGE1', 'ACGE2', 'ACST1', 'AEAC1', 'AEAC2', 'Airplane', 'ANCA1',
  'ASOT1', 'BOUM1', 'BRCA1', 'BRMA1', 'BRMA2', 'BUJA1', 'BUJA2', 'Bullfrog',
  'BUVI1', 'BUVI2', 'CACA1', 'CAGU1', 'CAGU2', 'CAGU3', 'CALA1', 'CALU1',
  'CAPU1', 'CAUS1', 'CAUS2', 'CCOO1', 'CCOO2', 'CECA1', 'Chainsaw', 'CHFA1',
  'Chicken', 'CHMI1', 'CHMI2', 'COAU1', 'COAU2', 'COBR1', 'COCO1', 'COSO1',
  'Cow', 'Creek', 'Cricket', 'CYST1', 'CYST2', 'DEFU1', 'DEFU2', 'Dog',
  'DRPU1', 'Drum', 'EMDI1', 'EMOB1', 'FACO1', 'FASP1', 'Fly', 'Frog',
  'GADE1', 'GLGN1', 'Growler', 'Gunshot', 'HALE1', 'HAPU1', 'HEVE1',
  'Highway', 'Horn', 'Human', 'HYPI1', 'IXNA1', 'IXNA2', 'JUHY1', 'LEAL1',
  'LECE1', 'LEVI1', 'LEVI2', 'LOCU1', 'MEFO1', 'MEGA1', 'MEKE1', 'MEKE2',
  'MEKE3', 'MYTO1', 'NUCO1', 'OCPR1', 'ODOC1', 'ORPI1', 'ORPI2', 'PAFA1',
  'PAFA2', 'PAHA1', 'PECA1', 'PHME1', 'PHNU1', 'PILU1', 'PILU2', 'PIMA1',
  'PIMA2', 'POEC1', 'POEC2', 'PSFL1', 'Rain', 'Raptor', 'SICU1', 'SITT1',
  'SITT2', 'SPHY1', 'SPHY2', 'SPPA1', 'SPPI1', 'SPTH1', 'STDE1', 'STNE1',
  'STNE2', 'STOC_4Note', 'STOC_Series', 'Strix_Bark', 'Strix_Whistle',
  'STVA_8Note', 'STVA_Insp', 'STVA_Series', 'Survey_Tone', 'TADO1', 'TADO2',
  'TAMI1', 'Thunder', 'TRAE1', 'Train', 'Tree', 'TUMI1', 'TUMI2', 'URAM1',
  'VIHU1', 'Wildcat', 'Yarder', 'ZEMA1', 'ZOLE1',
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

