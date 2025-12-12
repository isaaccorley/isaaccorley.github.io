'use client';

import type { Chart as ChartJS } from 'chart.js';
import Chart from 'chart.js/auto';
import { Paperclip } from 'lucide-react';
import type { InferenceSession } from 'onnxruntime-web';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPluginType from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { audioFileToSpectrograms, preloadEssentia } from './utils/audio-to-spectrogram';
import { getClassThumbnail } from './utils/class-mapper';
import { classifySpectrogramsBatch, type BatchInferenceResult, type InferenceResult } from './utils/inference';
import { loadBioacousticsModel } from './utils/model-loader';

const MODEL_PATH = '/bioacoustics/assets/Final_Model_slim.onnx';
const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
const MAX_SPECTROGRAM_HZ = 22050;


export default function BioacousticsDetectionAnalysisPage() {
  const [model, setModel] = useState<InferenceSession | null>(null);
  const [modelStatus, setModelStatus] = useState('Loading model…');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
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
    items: { label: string; confidence: number; className: string; humanReadableName?: string }[];
  } | null>(null);
  const [clipRegions, setClipRegions] = useState<
    { id: string; start: number; end: number; label: string }[]
  >([]);
  const [eqGains, setEqGains] = useState<number[]>(() => EQ_BANDS.map(() => 0));
  const specMaxHzRef = useRef(MAX_SPECTROGRAM_HZ);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveContainerRef = useRef<HTMLDivElement | null>(null);
  const spectrogramContainerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPluginType | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[] | null>(null);
  const eqAudioContextRef = useRef<AudioContext | null>(null);
  const eqSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const hoverHandlerRef = useRef<((time: number) => void) | null>(null);
  const spectrogramPluginRef = useRef<{ destroy?: () => void } | null>(null);
  const clipPredictionsRef = useRef<typeof clipPredictions>([]);
  const eqGainsRef = useRef<number[]>(EQ_BANDS.map(() => 0));
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<ChartJS<'bar', number[], string> | null>(null);
  const audioBlobUrlsRef = useRef<Set<string>>(new Set());
  const audioUrlCacheRef = useRef<Map<string, { blobUrl: string; file: File }>>(new Map());
  const blobUrlAlreadySetRef = useRef<boolean>(false);
  // Keep File objects in memory to prevent garbage collection
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const clipConfidenceSeries = useMemo<
    { clipNumber: number; speciesName: string; confidence: number }[]
  >(() =>
    clipPredictions.map((result, idx) => {
      const top = result.topPredictions[0];
      const speciesName = top?.humanReadableName ?? top?.className ?? `Clip ${idx + 1}`;
      return {
        clipNumber: idx + 1,
        speciesName,
        confidence: top?.confidence ?? 0,
      };
    }),
    [clipPredictions]
  );

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        setModelStatus('Loading model…');
        // Pre-initialize Essentia WASM to pre-allocate memory on page load
        // This prevents heap resize pauses during audio processing
        void preloadEssentia();
        
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
    
    // Get the media element from WaveSurfer (v7 specific)
    const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
    if (!media) {
      console.warn('setupEqualizer: Media element not available');
      return;
    }

    // Create a new AudioContext for this audio session
    // (We'll close it when the audio changes)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    eqAudioContextRef.current = ctx;
    
    // Create a MediaElementAudioSourceNode from the media element
    // This connects the HTML5 audio element to the Web Audio API
    // Note: createMediaElementSource can only be called once per media element
    // If it throws, the element is already connected - we'll handle that
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(media);
    } catch (error) {
      // Media element is already connected to an AudioContext
      // This shouldn't happen in normal flow, but handle gracefully
      console.warn('Media element already connected to AudioContext:', error);
      ctx.close().catch(console.error);
      eqAudioContextRef.current = null;
      return;
    }
    eqSourceNodeRef.current = source;
    
    // Create the filters
    const filters = EQ_BANDS.map((band, idx) => {
      const filter = ctx.createBiquadFilter();
      filter.type = band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking';
      filter.Q.value = 1;
      filter.frequency.value = band;
      // Invert the value because the slider is visually inverted due to RTL + rotation
      filter.gain.value = -(eqGainsRef.current[idx] ?? 0);
      return filter;
    });

    // Connect: source -> filter1 -> filter2 -> ... -> destination
    let currentNode: AudioNode = source;
    filters.forEach((filter) => {
      currentNode.connect(filter);
      currentNode = filter;
    });
    currentNode.connect(ctx.destination);
    
    // Verify the connection chain
    console.log('Connection chain: source ->', filters.length, 'filters -> destination');
    console.log('Source node:', source);
    console.log('Last filter:', filters[filters.length - 1]);
    console.log('Destination:', ctx.destination);

    // Important: When createMediaElementSource is called, the media element's audio
    // is automatically routed through the Web Audio API. The direct output is NOT
    // automatically disconnected, but we need to mute it to avoid double audio.
    // However, we'll do this only after confirming the AudioContext is running.

    // Save reference so the slider useEffect can update .gain values later
    eqFiltersRef.current = filters;
    
    console.log('Equalizer setup complete. AudioContext state:', ctx.state);
    console.log('Connected', filters.length, 'filters. Source connected:', source.numberOfOutputs > 0);
  }, []);

  useEffect(() => {
    const filters = eqFiltersRef.current;
    if (!filters) return;
    filters.forEach((f, idx) => {
      // Invert the value because the slider is visually inverted due to RTL + rotation
      const invertedGain = -eqGains[idx];
      if (f.gain.value !== invertedGain) {
        f.gain.value = invertedGain;
      }
    });
    eqGainsRef.current = eqGains;
  }, [eqGains]);

  useEffect(() => {
    return () => {
      // Disconnect filters
      if (eqFiltersRef.current) {
        eqFiltersRef.current.forEach((f) => f.disconnect());
        eqFiltersRef.current = null;
      }
      // Disconnect source node
      if (eqSourceNodeRef.current) {
        eqSourceNodeRef.current.disconnect();
        eqSourceNodeRef.current = null;
      }
      // Restore media element volume
      const ws = waveSurferRef.current;
      if (ws) {
        const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
        if (media) {
          media.volume = 1;
        }
      }
      // Note: We keep the AudioContext alive for reuse, but could close it here if needed
    };
  }, []);

  useEffect(() => {
    const ctx = chartCanvasRef.current?.getContext('2d');
    if (!ctx) return;

    const formatTooltipLabel = (index?: number) => {
      const entry = clipConfidenceSeries[index ?? 0];
      const probability = (entry?.confidence ?? 0) * 100;
      return `${entry?.speciesName ?? `Clip ${index ?? 1}`}: ${probability.toFixed(1)}%`;
    };

    if (clipConfidenceSeries.length === 0) {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      return;
    }

    const labels = clipConfidenceSeries.map(() => '');
    const datasetValues = clipConfidenceSeries.map(({ confidence }) => confidence);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = labels;
      chartInstanceRef.current.data.datasets[0].data = datasetValues;
      const tooltip = chartInstanceRef.current.options.plugins?.tooltip;
      if (tooltip) {
        tooltip.callbacks = {
          label: (context) => formatTooltipLabel(context.dataIndex),
        };
      }
      chartInstanceRef.current.update('none');
      return;
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
            {
              label: 'Max probability',
              data: datasetValues,
              borderWidth: 1,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              borderColor: '#10b981',
              borderRadius: 6,
              barPercentage: 0.75,
            },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            ticks: { display: false },
            grid: { display: false },
            title: { display: true, text: '12s clips' },
          },
          y: {
            min: 0.5,
            max: 1,
            ticks: {
              stepSize: 0.1,
              callback: (value) => `${Number(value).toFixed(2)}`,
            },
            title: { display: true, text: 'Max probability' },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => formatTooltipLabel(context.dataIndex),
            },
          },
          legend: { display: false },
        },
      },
    });
  }, [clipConfidenceSeries]);

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
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
    
    // Prevent duplicate WaveSurfer creation for the same URL
    // Check if we already have a WaveSurfer instance for this exact URL
    const existingWs = waveSurferRef.current;
    if (existingWs) {
      // Get the media element and check if it's using the same URL
      const media = (existingWs as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
      if (media && media.src === audioObjectUrl) {
        console.log('WaveSurfer already exists for this URL, skipping duplicate creation');
        return;
      }
      // If URL changed, destroy the old one first (will happen in cleanup)
      console.log('URL changed, will destroy old WaveSurfer in cleanup');
    }
    
    // Capture the current URL for this effect instance
    const currentUrl = audioObjectUrl;
    
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
      // Create formatHoverLabel function that reads from ref to show top predicted class
      const formatHoverLabel = (seconds: number): string => {
        if (!Number.isFinite(seconds)) {
          return formatTime(seconds);
        }
        const predictions = clipPredictionsRef.current;
        if (predictions.length === 0) {
          return formatTime(seconds);
        }
        const clipDuration = 12;
        const idx = Math.min(
          predictions.length - 1,
          Math.max(0, Math.floor(seconds / clipDuration))
        );
        const top = predictions[idx]?.topPredictions?.[0];
        if (!top) {
          return formatTime(seconds);
        }
        const className = top.humanReadableName ?? top.className;
        const confidence = (top.confidence * 100).toFixed(1);
        return `${className} ${confidence}%`;
      };
      const spectrogramContainer = spectrogramContainerRef.current;
      const waveformContainer = waveContainerRef.current;
      if (!waveformContainer || !spectrogramContainer) {
        return;
      }
        // Create spectrogram with default frequency - will be updated when sample rate is known
        const spectrogram = SpectrogramPlugin.create({
          container: spectrogramContainer,
          height: 200,
          labels: true,
          fftSamples: 2048,
          frequencyMax: specMaxHzRef.current,
          scale: 'log',
        });
        spectrogramPluginRef.current = spectrogram;
      // Verify the URL exists
      if (!currentUrl) {
        console.warn('Missing audio URL');
        return;
      }
      
      console.log('Creating WaveSurfer with URL:', currentUrl, 'Is tracked:', audioBlobUrlsRef.current.has(currentUrl));
      
      const hoverPlugin = HoverPlugin.create({
        formatTimeCallback: formatHoverLabel,
        labelColor: '#f8fafc',
        labelBackground: '#0f172a',
        lineColor: '#fcd34d',
      });
      
      const waveSurferInstance = WaveSurfer.create({
        container: waveformContainer,
        url: currentUrl, // Use the captured URL from the closure
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
          hoverPlugin,
        ],
      });
      
      ws = waveSurferInstance;
      waveSurferRef.current = waveSurferInstance;
        regionsPluginRef.current = regionsPlugin;
        waveSurferInstance.on('ready', () => {
        console.log('WaveSurfer ready with URL:', currentUrl);
        
        setAudioDuration(waveSurferInstance.getDuration() || 0);
        setCurrentTime(0);
        // Setup equalizer after a small delay to ensure media element is fully ready
        setTimeout(() => {
          setupEqualizer(waveSurferInstance);
        }, 100);
        const decoded = (waveSurferInstance as unknown as { getDecodedData?: () => AudioBuffer | null }).getDecodedData?.();
        const sr =
          decoded?.sampleRate ??
          ((waveSurferInstance as unknown as { backend?: { buffer?: AudioBuffer | null } }).backend?.buffer?.sampleRate ??
            null);
        if (sr && Number.isFinite(sr)) {
          const target = Math.min(MAX_SPECTROGRAM_HZ, sr / 2);
          const previousFreq = specMaxHzRef.current;
          // Update ref for future WaveSurfer instances
          specMaxHzRef.current = target;
          // Note: The current spectrogram was created with the previous frequency
          // We can't easily update it after creation, but future instances will use the correct frequency
          // If the frequency changed significantly, log it
          if (Math.abs(target - previousFreq) > 1000) {
            console.log(`Sample rate detected: ${sr}Hz, updating spectrogram max frequency from ${previousFreq}Hz to ${target}Hz`);
          }
        }
        // Update regions if available
        // Note: clipRegions might be empty initially, but will be updated by the separate useEffect
        if (regionsPlugin && clipRegions.length > 0) {
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
        
        // Register hover handler now that WaveSurfer is ready
        // Try multiple approaches for WaveSurfer v7
        type WaveSurferWithHover = WaveSurfer & {
          on(event: 'hover', callback: (time: number) => void): void;
        };
        type HoverPluginWithEvents = typeof hoverPlugin & {
          on(event: 'hover', callback: (time: number) => void): void;
          subscribe?: (event: string, callback: (time: number) => void) => void;
        };
        
        if (hoverHandlerRef.current) {
          // Try WaveSurfer instance
          try {
            (waveSurferInstance as WaveSurferWithHover).on('hover', hoverHandlerRef.current);
            console.log('Hover handler registered on WaveSurfer instance');
          } catch (e) {
            console.warn('Failed to register hover on WaveSurfer:', e);
          }
          
          // Try hoverPlugin
          try {
            if ((hoverPlugin as HoverPluginWithEvents).on) {
              (hoverPlugin as HoverPluginWithEvents).on('hover', hoverHandlerRef.current);
              console.log('Hover handler registered on hoverPlugin');
            } else if ((hoverPlugin as HoverPluginWithEvents).subscribe) {
              (hoverPlugin as HoverPluginWithEvents).subscribe?.('hover', hoverHandlerRef.current);
              console.log('Hover handler subscribed to hoverPlugin');
            }
          } catch (e) {
            console.warn('Failed to register hover on hoverPlugin:', e);
          }
          
          // Also add direct mouse move listener as fallback
          // This will work even if WaveSurfer's hover event doesn't fire
          const container = waveContainerRef.current;
          if (container) {
            const handleMouseMove = (e: MouseEvent) => {
              if (!container) return;
              const rect = container.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const progress = Math.max(0, Math.min(1, x / rect.width));
              const duration = waveSurferInstance.getDuration();
              if (duration && duration > 0) {
                const time = progress * duration;
                if (hoverHandlerRef.current) {
                  hoverHandlerRef.current(time);
                }
              }
            };
            
            container.addEventListener('mousemove', handleMouseMove);
            console.log('Direct mousemove listener added as fallback');
            
            // Store cleanup function
            (container as any)._hoverCleanup = () => {
              container.removeEventListener('mousemove', handleMouseMove);
            };
          }
        }
      });
      waveSurferInstance.on('audioprocess', () => {
        setCurrentTime(waveSurferInstance.getCurrentTime());
      });
      waveSurferInstance.on('play', async () => {
        setIsPlaying(true);
        // Ensure AudioContext is resumed when playback starts (required for audio)
        if (eqAudioContextRef.current) {
          if (eqAudioContextRef.current.state === 'suspended') {
            try {
              await eqAudioContextRef.current.resume();
              console.log('AudioContext resumed on play. State:', eqAudioContextRef.current.state);
            } catch (error) {
              console.error('Failed to resume AudioContext on play:', error);
              return;
            }
          }
          
          // Verify the connection chain
          if (eqSourceNodeRef.current && eqFiltersRef.current && eqFiltersRef.current.length > 0) {
            const lastFilter = eqFiltersRef.current[eqFiltersRef.current.length - 1];
            console.log('AudioContext state:', eqAudioContextRef.current.state);
            console.log('Source node:', eqSourceNodeRef.current);
            console.log('Last filter:', lastFilter);
            console.log('Destination:', eqAudioContextRef.current.destination);
            
            // Test: Try connecting source directly to destination to see if that works
            // (This will help us debug if the issue is with the filters)
            if (eqAudioContextRef.current.state === 'running') {
              console.log('Audio should be playing through Web Audio API');
            }
          } else {
            console.warn('Equalizer connection chain incomplete');
          }
        } else {
          console.warn('Equalizer not set up - AudioContext missing');
        }
      });
      waveSurferInstance.on('pause', () => setIsPlaying(false));
      
      // Create hover handler that reads from ref to avoid stale closures
      // This will be registered in the 'ready' event handler
      const hoverHandler = (time: number) => {
        console.log('Hover event fired, time:', time, 'predictions count:', clipPredictionsRef.current.length);
        setCurrentTime(time);
        const predictions = clipPredictionsRef.current;
        if (predictions.length === 0) {
          console.log('No predictions available, clearing hoverInfo');
          setHoverInfo(null);
          return;
        }
        const clipDuration = 12;
        const idx = Math.min(
          predictions.length - 1,
          Math.max(0, Math.floor(time / clipDuration))
        );
        const preds = predictions[idx]?.topPredictions ?? [];
        const items = preds.slice(0, 3).map((p) => ({
          label: p.humanReadableName ?? p.className,
          confidence: p.confidence,
          className: p.className,
          humanReadableName: p.humanReadableName,
        }));
        console.log('Setting hoverInfo:', { time, items });
        setHoverInfo({ time, items });
      };
      
      hoverHandlerRef.current = hoverHandler;
    })();
    return () => {
      cancelled = true;
      // Clean up mousemove listener if it was added
      const container = waveContainerRef.current;
      if (container && (container as any)._hoverCleanup) {
        (container as any)._hoverCleanup();
        delete (container as any)._hoverCleanup;
      }
      if (ws) {
        ws.destroy();
      }
      if (regionsPlugin) {
        regionsPlugin.destroy();
      }
      if (spectrogramPluginRef.current) {
        spectrogramPluginRef.current.destroy?.();
        spectrogramPluginRef.current = null;
      }
      waveSurferRef.current = null;
      regionsPluginRef.current = null;
      // Clean up equalizer
      if (eqFiltersRef.current) {
        eqFiltersRef.current.forEach((f) => f.disconnect());
        eqFiltersRef.current = null;
      }
      if (eqSourceNodeRef.current) {
        eqSourceNodeRef.current.disconnect();
        eqSourceNodeRef.current = null;
      }
      // Restore media element volume before closing context
      if (ws) {
        const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
        if (media) {
          media.volume = 1;
        }
      }
      if (eqAudioContextRef.current) {
        eqAudioContextRef.current.close().catch(console.error);
        eqAudioContextRef.current = null;
      }
      // Don't revoke blob URLs here - let them persist
      // Blob URLs are automatically cleaned up when the page unloads
      // Revoking them during normal operation causes race conditions
    };
  }, [audioObjectUrl, setupEqualizer]); // Only recreate WaveSurfer when audioObjectUrl changes

  // Cleanup blob URLs on component unmount
  useEffect(() => {
    const urlsToCleanup = audioBlobUrlsRef.current;
    return () => {
      urlsToCleanup.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore errors when revoking
        }
      });
      urlsToCleanup.clear();
    };
  }, []);

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

  // Update clipPredictions ref when clipPredictions state changes
  // This ensures the hover handler always has access to the latest predictions
  useEffect(() => {
    clipPredictionsRef.current = clipPredictions;
    console.log('clipPredictions updated, count:', clipPredictions.length);
  }, [clipPredictions]);

  const togglePlay = async () => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    
    // Resume AudioContext if suspended (required for audio playback)
    // This MUST happen on user interaction (clicking play button)
    if (eqAudioContextRef.current) {
      if (eqAudioContextRef.current.state === 'suspended') {
        try {
          await eqAudioContextRef.current.resume();
          console.log('AudioContext resumed in togglePlay. State:', eqAudioContextRef.current.state);
        } catch (error) {
          console.error('Failed to resume AudioContext in togglePlay:', error);
        }
      }
      
      // Verify connection chain exists
      if (!eqSourceNodeRef.current || !eqFiltersRef.current || eqFiltersRef.current.length === 0) {
        console.warn('Equalizer not properly set up. Source:', !!eqSourceNodeRef.current, 'Filters:', eqFiltersRef.current?.length ?? 0);
      } else {
        console.log('Equalizer ready. AudioContext state:', eqAudioContextRef.current.state);
      }
    } else {
      console.warn('No AudioContext available - equalizer not set up');
    }
    
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
    
    aggregated.sort((a, b) => (b.maxConfidence ?? 0) - (a.maxConfidence ?? 0));
    
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
      
      // Animate EQ sliders back to default (all zeros) smoothly
      // Use the ref to get the current values (avoids stale closure)
      const currentGains = [...eqGainsRef.current];
      const targetGains = EQ_BANDS.map(() => 0);
      const duration = 300; // milliseconds
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Use ease-out easing for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const newGains = currentGains.map((current, idx) => {
          const target = targetGains[idx];
          return current + (target - current) * eased;
        });
        
        setEqGains(newGains);
        eqGainsRef.current = newGains;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure we end exactly at 0
          setEqGains(targetGains);
          eqGainsRef.current = targetGains;
        }
      };
      
      requestAnimationFrame(animate);

      try {
        // Create blob URL and track it
        // If blob URL was already set (from URL cache), don't create a new one
        // This ensures we use the same blob URL that WaveSurfer will use
        if (!blobUrlAlreadySetRef.current) {
          const objectUrl = URL.createObjectURL(file);
          audioBlobUrlsRef.current.add(objectUrl);
          fileCacheRef.current.set(objectUrl, file); // Keep File alive by blob URL
          setAudioObjectUrl(objectUrl);
        }
        // Reset the flag for next time
        blobUrlAlreadySetRef.current = false;
        setProcessingStatus('Converting audio to spectrograms…');
        // Don't show progress for spectrogram conversion
        
        const spectrograms = await audioFileToSpectrograms(
          file,
          {
            width: 1000,
            height: 257,
            sampleRate: 8000,
            duration: 12,
            dynamicRange: 90,
          }
          // No progress callback - don't show progress for spectrogram conversion
        );

        if (spectrograms.length === 0) {
          throw new Error('No spectrograms generated from audio file');
        }

        setProcessingStatus(`Analyzing ${spectrograms.length} clip${spectrograms.length > 1 ? 's' : ''}…`);
        setProcessingProgress(0);
        
        const batchResult = await classifySpectrogramsBatch(
          model,
          spectrograms,
          (current, total) => {
            // Use requestAnimationFrame to ensure smooth UI updates
            requestAnimationFrame(() => {
              const percentage = Math.round((current / total) * 100);
              setProcessingProgress(percentage);
            });
          }
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
        setProcessingProgress(null);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to process audio file'
        );
        setProcessingProgress(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [model, aggregateResults]
  );

  const processAudioFromUrl = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        setErrorMessage('Please enter an audio file URL.');
        return;
      }
      setErrorMessage(null);
      try {
        // Check if we have this URL cached
        let cached = audioUrlCacheRef.current.get(url);
        
        if (!cached) {
          setProcessingStatus('Downloading audio…');
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) {
            throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
          }
          const contentType = response.headers.get('content-type') ?? 'audio/wav';
          const arrayBuffer = await response.arrayBuffer();
          const inferredName = url.split('/').pop() || 'audio-from-url.wav';
          const file = new File([arrayBuffer], inferredName, { type: contentType });
          
          // Create blob URL and cache it
          // Keep the File object in a separate cache to prevent garbage collection
          const blobUrl = URL.createObjectURL(file);
          audioBlobUrlsRef.current.add(blobUrl);
          fileCacheRef.current.set(blobUrl, file); // Keep File alive by blob URL
          cached = { blobUrl, file };
          audioUrlCacheRef.current.set(url, cached);
        }
        
        setFileName(cached.file.name);
        
        // Use the cached blob URL - this ensures WaveSurfer uses the same URL
        // that we'll use for processing, preventing the ERR_FILE_NOT_FOUND error
        // Set the blob URL and wait a bit to ensure state updates
        setAudioObjectUrl(cached.blobUrl);
        blobUrlAlreadySetRef.current = true; // Signal that blob URL is already set
        
        // Small delay to ensure the state update propagates and useEffect starts
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Process the cached file
        // processAudioFile will see that blobUrlAlreadySetRef is true and won't create a new URL
        await processAudioFile(cached.file);
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
              Live, on-device bioacoustics detection and analysis
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Bioacoustics Detection and Analysis
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
                    <div className="flex items-center gap-2">
                      {isProcessing && processingProgress !== null && (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-emerald-400" />
                          <span className="text-slate-200">{processingStatus}</span>
                          <span className="text-emerald-300 font-medium">{processingProgress}%</span>
                        </>
                      )}
                      {(!isProcessing || processingProgress === null) && (
                        <span className="text-slate-200">{processingStatus}</span>
                      )}
                    </div>
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
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
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
                Waveform / Spectrogram
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
                  {hoverInfo.items.map((item, idx) => {
                    const thumbnailUrl = getClassThumbnail(item.className, item.humanReadableName);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {thumbnailUrl && (
                            <img
                              src={thumbnailUrl}
                              alt={item.label}
                              className="h-6 w-6 rounded object-cover border border-slate-700/50 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="truncate">{item.label}</span>
                        </div>
                        <span className="text-emerald-300 flex-shrink-0">{(item.confidence * 100).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {clipConfidenceSeries.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                    Species detected per clip
                  </h3>
                  <span className="text-[10px] text-slate-500">Max probability per 12s clip</span>
                </div>
                <div className="h-56 w-full rounded-xl border border-slate-800/70 bg-slate-950/60 p-2">
                  <canvas ref={chartCanvasRef} className="h-full w-full" />
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
                    <span className="flex-1">Species</span>
                    <span className="w-14 text-right">Max</span>
                  </div>
                  {classificationResult.topPredictions.slice(0, 5).map((pred) => {
                    const thumbnailUrl = getClassThumbnail(pred.className, pred.humanReadableName);
                    return (
                    <div
                      key={pred.classIndex}
                      className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 shadow-inner shadow-black/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {thumbnailUrl && (
                            <img
                              src={thumbnailUrl}
                              alt={pred.humanReadableName ?? pred.className}
                              className="h-10 w-10 rounded-lg object-cover border border-slate-700/50"
                              onError={(e) => {
                                // Hide image if it fails to load
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-100">
                              {pred.humanReadableName ?? pred.className}
                            </span>
                            {(() => {
                              // Only show Info link for bird species, not for non-bird classes
                              const nonBirdClasses = [
                                'Airplane', 'Chainsaw', 'Creek', 'Rain', 'Highway', 'Dog', 'Human', 
                                'Train', 'Thunder', 'Gunshot', 'Cricket', 'Amphibian', 'Growler',
                                'Truck beep', 'Survey Tone', 'Tree creak', 'Wildcat', 'Yarder',
                                'American Bullfrog', 'Bullfrog', 'Chicken', 'Cow', 'Fly', 'Frog',
                                'Tree', 'Raptor', 'Falcon sp.', 'Flycatcher sp.', 'Empidonax sp.',
                                'Odocoileus sp.', 'Uramus sp.', 'Mega sp.'
                              ];
                              const displayName = (pred.humanReadableName ?? pred.className).replace(/\s*\([^)]*\)\s*/g, '').trim();
                              const isBird = !nonBirdClasses.includes(displayName) && 
                                            !nonBirdClasses.includes(pred.className) &&
                                            !nonBirdClasses.includes(pred.humanReadableName ?? '');
                              
                              if (!isBird) return null;
                              
                              return (
                                <a
                                  href={`https://dibird.com/search/?q=${encodeURIComponent(displayName)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors"
                                >
                                  Info
                                </a>
                              );
                            })()}
                          </div>
                        </div>
                        <span className="w-14 text-right text-sm text-emerald-300">
                          {((pred.maxConfidence ?? pred.confidence) * 100).toFixed(2)}%
                        </span>
                      </div>
                      {pred.humanReadableName && pred.humanReadableName !== pred.className && (
                        <span className="text-xs text-slate-500">
                          {pred.className}
                        </span>
                      )}
                    </div>
                    );
                  })}
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

