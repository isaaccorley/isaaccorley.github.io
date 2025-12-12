'use client';

import { Paperclip } from 'lucide-react';
import type { InferenceSession } from 'onnxruntime-web';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPluginType from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { audioFileToSpectrograms } from './utils/audio-to-spectrogram';
import { classifySpectrogramsBatch, type BatchInferenceResult, type InferenceResult } from './utils/inference';
import { loadBioacousticsModel } from './utils/model-loader';

const MODEL_PATH = '/bioacoustics/assets/Final_Model_slim.onnx';
const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export default function BioacousticsClassificationPage() {
  const [model, setModel] = useState<InferenceSession | null>(null);
  const [modelStatus, setModelStatus] = useState('Loading model…');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [classificationResult, setClassificationResult] = useState<InferenceResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchInferenceResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [recordingUrls, setRecordingUrls] = useState<string[]>([]);
  const [clipPredictions, setClipPredictions] = useState<InferenceResult[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{
    time: number;
    items: { label: string; confidence: number }[];
  } | null>(null);
  const [clipRegions, setClipRegions] = useState<
    { id: string; start: number; end: number; label: string }[]
  >([]);
  const [eqGains, setEqGains] = useState<number[]>(() => EQ_BANDS.map(() => 0));
  const [specMaxHz, setSpecMaxHz] = useState(4000);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveContainerRef = useRef<HTMLDivElement | null>(null);
  const spectrogramContainerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPluginType | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[] | null>(null);
  const eqGainsRef = useRef<number[]>(EQ_BANDS.map(() => 0));

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        setModelStatus('Loading model…');
        const loadedModel = await loadBioacousticsModel(MODEL_PATH);
        if (cancelled) return;
        setModel(loadedModel);
        setModelStatus('Model ready');
      } catch (error) {
        if (cancelled) return;
        console.error('Model loading error:', error);
        setErrorMessage(
          error instanceof Error
            ? `Failed to load model: ${error.message}`
            : 'Failed to load model'
        );
        setModelStatus('Model failed to load');
      }
    };

    void loadModel();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRecordings = async () => {
      try {
        const res = await fetch('/bioacoustics/assets/recordings.txt');
        if (!res.ok) return;
        const text = await res.text();
        const urls = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (!cancelled) {
          setRecordingUrls(urls);
        }
      } catch {
        // ignore
      }
    };
    void loadRecordings();
    return () => {
      cancelled = true;
    };
  }, []);

  const setupEqualizer = useCallback((ws: WaveSurfer) => {
    if (!ws) return;
    if (eqFiltersRef.current) return;
    const ctx = (ws as unknown as { getAudioContext?: () => AudioContext | null }).getAudioContext?.() ?? null;
    if (!ctx) return;
    const filters = EQ_BANDS.map((band, idx) => {
      const filter = ctx.createBiquadFilter();
      filter.type = band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking';
      filter.Q.value = 1;
      filter.frequency.value = band;
      filter.gain.value = eqGainsRef.current[idx] ?? 0;
      return filter;
    });
    const setFilters = (ws as unknown as { setFilters?: (filters: BiquadFilterNode[]) => void }).setFilters;
    if (setFilters) {
      setFilters(filters);
    } else {
      filters.forEach((f) => f.connect(ctx.destination));
    }
    eqFiltersRef.current = filters;
  }, []);

  useEffect(() => {
    const filters = eqFiltersRef.current;
    if (!filters) return;
    filters.forEach((f, idx) => {
      if (f.gain.value !== eqGains[idx]) {
        f.gain.value = eqGains[idx];
      }
    });
    eqGainsRef.current = eqGains;
  }, [eqGains]);

  useEffect(() => {
    return () => {
      if (eqFiltersRef.current) {
        eqFiltersRef.current.forEach((f) => f.disconnect());
      }
      eqFiltersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !audioObjectUrl ||
      !waveContainerRef.current ||
      !spectrogramContainerRef.current
    ) {
      return;
    }
    let ws: WaveSurfer | null = null;
    let regionsPlugin: RegionsPluginType | null = null;
    let cancelled = false;
    (async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default;
      const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.esm.js')).default;
      const SpectrogramPlugin = (await import('wavesurfer.js/dist/plugins/spectrogram.esm.js')).default;
      const HoverPlugin = (await import('wavesurfer.js/dist/plugins/hover.esm.js')).default;
      if (cancelled) return;
      regionsPlugin = RegionsPlugin.create();
      const formatHoverLabel = (seconds: number): string => {
        if (!Number.isFinite(seconds) || clipPredictions.length === 0) {
          return formatTime(seconds);
        }
        const clipDuration = 12;
        const idx = Math.min(
          clipPredictions.length - 1,
          Math.max(0, Math.floor(seconds / clipDuration))
        );
        const top = clipPredictions[idx]?.topPredictions?.[0];
        if (!top) return formatTime(seconds);
        return `${top.humanReadableName ?? top.className} ${(top.confidence * 100).toFixed(1)}%`;
      };
      const spectrogramContainer = spectrogramContainerRef.current;
      const waveformContainer = waveContainerRef.current;
      if (!waveformContainer || !spectrogramContainer) {
        return;
      }
      const spectrogram = SpectrogramPlugin.create({
        container: spectrogramContainer,
        height: 180,
        labels: true,
        fftSamples: 1024,
        frequencyMax: specMaxHz,
        scale: 'linear',
      });
      const waveSurferInstance = WaveSurfer.create({
        container: waveformContainer,
        url: audioObjectUrl,
        height: 140,
        waveColor: '#94a3b8',
        progressColor: '#c084fc',
        cursorColor: '#fcd34d',
        normalize: true,
        barRadius: 2,
        barWidth: 2,
        barGap: 1,
        plugins: [
          regionsPlugin,
          spectrogram,
          HoverPlugin.create({
            formatTimeCallback: formatHoverLabel,
            labelColor: '#f8fafc',
            labelBackground: '#0f172a',
            lineColor: '#fcd34d',
          }),
        ],
      });
      ws = waveSurferInstance;
      waveSurferRef.current = waveSurferInstance;
      regionsPluginRef.current = regionsPlugin;
      waveSurferInstance.on('ready', () => {
        setAudioDuration(waveSurferInstance.getDuration() || 0);
        setCurrentTime(0);
        void setupEqualizer(waveSurferInstance);
        const decoded = (waveSurferInstance as unknown as { getDecodedData?: () => AudioBuffer | null }).getDecodedData?.();
        const sr =
          decoded?.sampleRate ??
          ((waveSurferInstance as unknown as { backend?: { buffer?: AudioBuffer | null } }).backend?.buffer?.sampleRate ??
            null);
        if (sr && Number.isFinite(sr)) {
          const target = Math.min(8000, sr / 2);
          if (Math.abs(target - specMaxHz) > 1) {
            setSpecMaxHz(target);
          }
        }
        if (regionsPlugin) {
          regionsPlugin.clearRegions();
          clipRegions.forEach((r) => {
            if (!regionsPlugin) return;
            regionsPlugin.addRegion({
              start: r.start,
              end: r.end,
              color: 'rgba(192,132,252,0.18)',
              drag: false,
              resize: false,
            });
          });
        }
      });
      waveSurferInstance.on('audioprocess', () => {
        setCurrentTime(waveSurferInstance.getCurrentTime());
      });
      waveSurferInstance.on('play', () => setIsPlaying(true));
      waveSurferInstance.on('pause', () => setIsPlaying(false));
      type WaveSurferWithHover = WaveSurfer & {
        on(event: 'hover', callback: (time: number) => void): void;
      };
      (waveSurferInstance as WaveSurferWithHover).on('hover', (time: number) => {
        setCurrentTime(time);
        if (clipPredictions.length === 0) {
          setHoverInfo(null);
          return;
        }
        const clipDuration = 12;
        const idx = Math.min(
          clipPredictions.length - 1,
          Math.max(0, Math.floor(time / clipDuration))
        );
        const preds = clipPredictions[idx]?.topPredictions ?? [];
        const items = preds.slice(0, 3).map((p) => ({
          label: p.humanReadableName ?? p.className,
          confidence: p.confidence,
        }));
        setHoverInfo({ time, items });
      });
    })();
    return () => {
      cancelled = true;
      if (ws) {
        ws.destroy();
      }
      if (regionsPlugin) {
        regionsPlugin.destroy();
      }
      waveSurferRef.current = null;
      regionsPluginRef.current = null;
    };
  }, [audioObjectUrl, clipRegions, clipPredictions, setupEqualizer, specMaxHz]);

  useEffect(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin) return;
    regionsPlugin.clearRegions();
    clipRegions.forEach((r) =>
      regionsPlugin.addRegion({
        start: r.start,
        end: r.end,
        color: 'rgba(192,132,252,0.18)',
        drag: false,
        resize: false,
      })
    );
  }, [clipRegions]);

  const togglePlay = () => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    if (ws.isPlaying && ws.isPlaying()) {
      ws.pause();
    } else {
      ws.play();
    }
  };

  const formatTime = (seconds: number | undefined): string => {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const aggregateResults = useCallback((results: InferenceResult[]): InferenceResult => {
    const classScores = new Map<
      number,
      {
        className: string;
        humanReadableName?: string;
        totalConfidence: number;
        maxConfidence: number;
        count: number;
      }
    >();
    
    results.forEach((result) => {
      result.allPredictions.forEach((pred) => {
        if (!classScores.has(pred.classIndex)) {
          classScores.set(pred.classIndex, {
            className: pred.className,
            humanReadableName: pred.humanReadableName,
            totalConfidence: 0,
            maxConfidence: 0,
            count: 0,
          });
        }
        const entry = classScores.get(pred.classIndex)!;
        entry.totalConfidence += pred.confidence;
        entry.maxConfidence = Math.max(entry.maxConfidence, pred.confidence);
        entry.count += 1;
        if (!entry.humanReadableName && pred.humanReadableName) {
          entry.humanReadableName = pred.humanReadableName;
        }
      });
    });
    
    const aggregated: InferenceResult['allPredictions'] = Array.from(classScores.entries()).map(
      ([
        classIndex,
        { className, humanReadableName, totalConfidence, maxConfidence, count },
      ]) => ({
        className,
        humanReadableName,
        confidence: totalConfidence / count,
        meanConfidence: totalConfidence / count,
        maxConfidence,
        classIndex,
      })
    );
    
    aggregated.sort((a, b) => b.confidence - a.confidence);
    
    return {
      topPredictions: aggregated.slice(0, 5),
      allPredictions: aggregated,
    };
  }, []);

  const processAudioFile = useCallback(
    async (file: File) => {
      if (!model) {
        setErrorMessage('Model is not ready yet. Please wait and try again.');
        return;
      }

      setErrorMessage(null);
      setClassificationResult(null);
      setBatchResult(null);
      setIsProcessing(true);

      try {
        if (audioObjectUrl) {
          URL.revokeObjectURL(audioObjectUrl);
          setAudioObjectUrl(null);
        }
        const objectUrl = URL.createObjectURL(file);
        setAudioObjectUrl(objectUrl);
        setProcessingStatus('Converting audio to spectrograms…');
        const spectrograms = await audioFileToSpectrograms(file, {
          width: 1000,
          height: 257,
          sampleRate: 8000,
          duration: 12,
          dynamicRange: 90,
        });

        if (spectrograms.length === 0) {
          throw new Error('No spectrograms generated from audio file');
        }

        setProcessingStatus(`Classifying ${spectrograms.length} clip${spectrograms.length > 1 ? 's' : ''}…`);
        
        const batchResult = await classifySpectrogramsBatch(
          model,
          spectrograms
        );

        setBatchResult(batchResult);
        setClipPredictions(batchResult.results);
        const clipDuration = 12;
        const totalDuration = spectrograms.length * clipDuration;
        setAudioDuration(totalDuration);
        const regions = batchResult.results.map((res, idx) => {
          const start = idx * clipDuration;
          const end = Math.min(start + clipDuration, totalDuration);
          const top = res.topPredictions[0];
          const label = `${top.humanReadableName ?? top.className} ${(top.confidence * 100).toFixed(1)}%`;
          return { id: `clip-${idx}`, start, end, label };
        });
        setClipRegions(regions);
        
        if (batchResult.results.length === 1) {
          setClassificationResult(batchResult.results[0]);
        } else {
          const aggregated = aggregateResults(batchResult.results);
          setClassificationResult(aggregated);
        }
        
        setProcessingStatus('Done');
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to process audio file'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [model, aggregateResults, audioObjectUrl]
  );

  const processAudioFromUrl = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        setErrorMessage('Please enter an audio file URL.');
        return;
      }
      setErrorMessage(null);
      try {
        setProcessingStatus('Downloading audio…');
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type') ?? 'audio/wav';
        const arrayBuffer = await response.arrayBuffer();
        const inferredName = url.split('/').pop() || 'audio-from-url.wav';
        const file = new File([arrayBuffer], inferredName, { type: contentType });
        setFileName(inferredName);
        await processAudioFile(file);
      } catch (error) {
        console.error('Error processing URL audio:', error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to process audio from URL'
        );
        setIsProcessing(false);
      }
    },
    [processAudioFile]
  );

  const handleRandomUrl = useCallback(() => {
    if (recordingUrls.length === 0) {
      setErrorMessage('No recordings available.');
      return;
    }
    const idx = Math.floor(Math.random() * recordingUrls.length);
    const url = recordingUrls[idx];
    setAudioUrl(url);
    void processAudioFromUrl(url);
  }, [processAudioFromUrl, recordingUrls]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';
    const lowerName = file.name.toLowerCase();
    const looksLikeAudio =
      lowerName.endsWith('.wav') ||
      lowerName.endsWith('.mp4') ||
      lowerName.endsWith('.m4a') ||
      lowerName.endsWith('.mp3') ||
      lowerName.endsWith('.ogg');
    const mime = file.type.toLowerCase();
    const mimeLooksLikeAudio =
      mime.includes('audio') || mime.includes('video');

    if (!looksLikeAudio && !mimeLooksLikeAudio) {
      setErrorMessage('Please select an audio file (.wav, .mp4, .mp3, etc.)');
      return;
    }

    setFileName(file.name);
    await processAudioFile(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-930 to-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-12 pt-12">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/60 px-8 py-10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(248,113,113,0.12),transparent_25%)]" />
          <div className="relative flex flex-col gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live, on-device bioacoustics classifier
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Bioacoustics Classification
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              Paste a URL or attach audio. We’ll generate spectrograms and run the on-device ONNX
              model across all clips, returning the top species with human-readable labels.
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Audio Input
              </h3>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void processAudioFromUrl(audioUrl);
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!model || isProcessing}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 shadow-inner shadow-black/20 transition hover:border-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Upload local file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/audio.wav"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    disabled={!model || isProcessing}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner shadow-black/20 outline-none ring-1 ring-transparent transition hover:border-slate-700 focus:border-emerald-400 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!model || isProcessing}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-medium text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Process
                  </button>
                  <button
                    type="button"
                    onClick={handleRandomUrl}
                    disabled={!model || isProcessing || recordingUrls.length === 0}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-medium text-slate-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Random
                  </button>
                  <input
                    ref={fileInputRef}
                    id="audio-upload"
                    type="file"
                    accept="audio/*,video/*,.wav,.mp4,.mp3,.m4a,.ogg"
                    onChange={handleFileChange}
                    disabled={!model || isProcessing}
                    className="hidden"
                  />
                </div>
              </form>

              <div className="grid gap-2 text-sm text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">Model:</span>
                  <span className="rounded-full bg-slate-800/80 px-2 py-1 text-xs text-slate-200">
                    {modelStatus}
                  </span>
                </span>
                {processingStatus && (
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">Processing:</span>
                    <span className="text-slate-200">{processingStatus}</span>
                  </span>
                )}
                {fileName && (
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">File:</span> {fileName}
                  </span>
                )}
                {batchResult && batchResult.totalClips > 1 && (
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">Clips:</span>{' '}
                    {batchResult.totalClips}
                  </span>
                )}
              </div>
            </div>

            <div className="w-full justify-self-end space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Equalizer
                </span>
                <span className="text-[11px] text-slate-400">-40 dB to +40 dB</span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-slate-800/70 bg-slate-950/70 p-3">
                <div className="flex items-end gap-3 overflow-x-auto pb-1">
                  {EQ_BANDS.map((band, idx) => (
                    <div key={band} className="flex flex-col items-center gap-1 text-[10px] text-slate-300">
                      <div className="relative flex h-28 w-8 items-center justify-center">
                        <div className="absolute inset-y-2 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-slate-700/70" />
                        <input
                          type="range"
                          min={-40}
                          max={40}
                          step={0.5}
                          value={eqGains[idx]}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            if (Number.isNaN(next)) return;
                            setEqGains((g) => {
                              const copy = [...g];
                              copy[idx] = next;
                              return copy;
                            });
                          }}
                          className="relative z-10 h-28 w-3 appearance-none bg-transparent accent-emerald-300"
                          style={{
                            WebkitAppearance: 'slider-vertical',
                            writingMode: 'vertical-lr',
                            transform: 'rotate(180deg)',
                          }}
                        />
                      </div>
                      <span>{band >= 1000 ? `${band / 1000}k` : band}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Waveform
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span>
                  {formatTime(currentTime)} / {formatTime(audioDuration)}
                </span>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!audioObjectUrl || isProcessing}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
              </div>
            </div>
            <div
              ref={waveContainerRef}
              className="h-32 w-full rounded-xl border border-slate-800/70 bg-slate-950/60"
            />
            <div
              ref={spectrogramContainerRef}
              className="h-44 w-full rounded-lg border border-slate-800/70 bg-slate-950/60"
            />
            {hoverInfo && (
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 shadow-inner shadow-black/30">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Clip @ {formatTime(hoverInfo.time)}</span>
                  <span>Top 3</span>
                </div>
                <div className="mt-1 space-y-1">
                  {hoverInfo.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span>{idx + 1}. {item.label}</span>
                      <span className="text-amber-200">{(item.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

            {classificationResult && (
            <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Top 5 Detected Species
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    <span>Species</span>
                    <span className="flex items-center gap-4">
                      <span>Mean</span>
                      <span>Max</span>
                    </span>
                  </div>
                  {classificationResult.topPredictions.slice(0, 5).map((pred) => (
                    <div
                      key={pred.classIndex}
                      className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 shadow-inner shadow-black/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-100">
                          {pred.humanReadableName ?? pred.className}
                        </span>
                        <div className="flex items-center gap-4 text-sm text-emerald-300">
                          <span>
                            {((pred.meanConfidence ?? pred.confidence) * 100).toFixed(2)}%
                        </span>
                          <span>{((pred.maxConfidence ?? pred.confidence) * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                      {pred.humanReadableName && pred.humanReadableName !== pred.className && (
                        <span className="text-xs text-slate-500">
                          {pred.className}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            {errorMessage && (
                <p className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200 shadow-inner shadow-red-900/40">
                {errorMessage}
              </p>
            )}
          </div>
          )}
        </div>
      </div>
  );
}

