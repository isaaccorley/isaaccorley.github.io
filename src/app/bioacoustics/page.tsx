'use client';

import type { Chart as ChartJS } from 'chart.js';
import Chart from 'chart.js/auto';
import { Download, Info, Paperclip, Volume2 } from 'lucide-react';

// Add CSS for screen reader only content if not already in globals.css
// .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0; }

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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(0.75);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [audioMetadata, setAudioMetadata] = useState<{
    sampleRate?: number;
    duration?: number;
    dateTime?: string;
    location?: { lat?: number; lon?: number; name?: string };
  } | null>(null);
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
  const tooltipElementRef = useRef<HTMLDivElement | null>(null);
  const audioBlobUrlsRef = useRef<Set<string>>(new Set());
  const audioUrlCacheRef = useRef<Map<string, { blobUrl: string; file: File }>>(new Map());
  const blobUrlAlreadySetRef = useRef<boolean>(false);
  // Keep File objects in memory to prevent garbage collection
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const clipConfidenceSeries = useMemo<
    { clipNumber: number; speciesName: string; confidence: number; className?: string; humanReadableName?: string }[]
  >(() =>
    clipPredictions.map((result, idx) => {
      const top = result.topPredictions[0];
      const speciesName = top?.humanReadableName ?? top?.className ?? `Segment ${idx + 1}`;
      return {
        clipNumber: idx + 1,
        speciesName,
        confidence: top?.confidence ?? 0,
        className: top?.className,
        humanReadableName: top?.humanReadableName,
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
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext is not supported in this browser');
    }
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

    // Clean up any existing tooltip from previous effect run
    const cleanupTooltip = () => {
      if (tooltipElementRef.current instanceof HTMLDivElement) {
        const tooltipEl = tooltipElementRef.current;
        // Check if element is still connected to the DOM
        if (tooltipEl.isConnected && tooltipEl.parentNode) {
          try {
            // Use remove() which is safer - it doesn't throw if element is not a child
            tooltipEl.remove();
          } catch (e) {
            // Silently ignore - element was already removed
            console.debug('Tooltip already removed:', e);
          }
        }
        tooltipElementRef.current = null;
      }
    };

    // Create custom tooltip element
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getOrCreateTooltip = (chart: ChartJS) => {
      // If tooltip exists but is not connected to the DOM, clean it up first
      if (tooltipElementRef.current && !tooltipElementRef.current.isConnected) {
        tooltipElementRef.current = null;
      }
      
      if (!tooltipElementRef.current) {
        // Clean up any existing tooltip before creating a new one
        cleanupTooltip();
        
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl pointer-events-none';
        tooltipEl.style.opacity = '0';
        tooltipEl.style.position = 'fixed'; // Use fixed instead of absolute
        tooltipEl.style.transform = 'translate(-50%, 0)';
        tooltipEl.style.transition = 'opacity 0.1s';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.zIndex = '1000';
        // Append to document.body instead of chart parent to avoid React reconciliation issues
        document.body.appendChild(tooltipEl);
        tooltipElementRef.current = tooltipEl;
      }
      return tooltipElementRef.current;
    };

    const formatTooltipLabel = (index?: number) => {
      const entry = clipConfidenceSeries[index ?? 0];
      const probability = (entry?.confidence ?? 0) * 100;
      return `${entry?.speciesName ?? `Segment ${index ?? 1}`}: ${probability.toFixed(1)}%`;
    };

    if (clipConfidenceSeries.length === 0) {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      cleanupTooltip();
      return;
    }

    const labels = clipConfidenceSeries.map(() => '');
    const datasetValues = clipConfidenceSeries.map(({ confidence }) => confidence);

    if (chartInstanceRef.current) {
      // Chart exists - just update the data
      // Ensure tooltip is still valid (it should be, but check if it's orphaned)
      if (tooltipElementRef.current && !tooltipElementRef.current.isConnected) {
        // Tooltip was orphaned, clean it up - it will be recreated by getOrCreateTooltip when needed
        tooltipElementRef.current = null;
      }
      
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
            title: { display: true, text: '12s segments' },
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
            enabled: false,
            external: (context) => {
              const { chart, tooltip } = context;
              const tooltipEl = getOrCreateTooltip(chart);
              if (!tooltipEl) return;
              
              if (tooltip.opacity === 0) {
                tooltipEl.style.opacity = '0';
                return;
              }

              const dataIndex = tooltip.dataPoints[0]?.dataIndex ?? 0;
              const entry = clipConfidenceSeries[dataIndex];
              if (!entry) {
                tooltipEl.style.opacity = '0';
                return;
              }

              const thumbnailUrl = getClassThumbnail(entry.className ?? '', entry.humanReadableName);
              const probability = (entry.confidence * 100).toFixed(1);
              
              const thumbnailHtml = thumbnailUrl 
                ? `<img src="${thumbnailUrl}" alt="${entry.speciesName}" class="h-12 w-12 rounded-lg object-cover border border-slate-700/50 flex-shrink-0" />`
                : '';
              
              tooltipEl.innerHTML = `
                <div class="flex items-center gap-3">
                  ${thumbnailHtml}
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-slate-100">${entry.speciesName}</span>
                    <span class="text-xs text-emerald-300">${probability}%</span>
                  </div>
                </div>
              `;

              // Calculate position relative to viewport since tooltip is now fixed
              const position = chart.canvas.getBoundingClientRect();
              tooltipEl.style.opacity = '1';
              tooltipEl.style.left = (position.left + tooltip.caretX) + 'px';
              // Position tooltip higher above the cursor (subtract 60px offset)
              tooltipEl.style.top = (position.top + tooltip.caretY - 70) + 'px';
            },
          },
          legend: { display: false },
        },
      },
    });

    return () => {
      cleanupTooltip();
    };
  }, [clipConfidenceSeries]);

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
      // Clean up tooltip on unmount
      if (tooltipElementRef.current instanceof HTMLDivElement) {
        const tooltipEl = tooltipElementRef.current;
        // Check if element is still connected to the DOM and has a parent
        if (tooltipEl.isConnected && tooltipEl.parentNode) {
          try {
            // Use remove() which is safer - it doesn't throw if element is not a child
            tooltipEl.remove();
          } catch (e) {
            // Silently ignore - element was already removed
            console.debug('Tooltip already removed on unmount:', e);
          }
        }
        tooltipElementRef.current = null;
      }
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
    
    // Additional safety: check if containers are already populated by plugins
    // This can happen in React Strict Mode where effects run twice
    if (waveContainerRef.current?.children.length || spectrogramContainerRef.current?.children.length) {
      console.warn('Containers already have children, cleaning up before creating new WaveSurfer');
      // Clean up any existing plugins first
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying existing wavesurfer:', e);
        }
        waveSurferRef.current = null;
      }
      if (regionsPluginRef.current) {
        try {
          regionsPluginRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying existing regions:', e);
        }
        regionsPluginRef.current = null;
      }
      if (spectrogramPluginRef.current) {
        try {
          spectrogramPluginRef.current.destroy?.();
        } catch (e) {
          console.warn('Error destroying existing spectrogram:', e);
        }
        spectrogramPluginRef.current = null;
      }
    }
    
    // Capture the current URL for this effect instance
    const currentUrl = audioObjectUrl;
    
    let ws: WaveSurfer | null = null;
    let regionsPlugin: RegionsPluginType | null = null;
    let cancelled = false;
    // Capture container refs at the start of the effect for cleanup
    const containerForCleanup = waveContainerRef.current;
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
        // Create spectrogram - will be recreated with correct frequency range once sample rate is known
        // For now, create with a placeholder that will be replaced
        const spectrogram = SpectrogramPlugin.create({
          container: spectrogramContainer,
          height: 200,
          labels: true,
          fftSamples: 2048,
          frequencyMax: specMaxHzRef.current,
          frequencyMin: 0,
          scale: 'linear' as const,
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
        
        // Update metadata
        const duration = waveSurferInstance.getDuration() || 0;
        setAudioMetadata({
          sampleRate: sr && Number.isFinite(sr) ? sr : undefined,
          duration: duration > 0 ? duration : undefined,
        });
        
        if (sr && Number.isFinite(sr)) {
          const nyquistFreq = sr / 2;
          const targetMax = Math.min(MAX_SPECTROGRAM_HZ, nyquistFreq);
          const previousFreq = specMaxHzRef.current;
          
          // Update ref for future WaveSurfer instances
          specMaxHzRef.current = targetMax;
          
          // Always recreate spectrogram on first load or if frequency range changed
          // This ensures it's properly initialized with WaveSurfer
          const shouldRecreate = Math.abs(targetMax - previousFreq) > 1 || previousFreq === MAX_SPECTROGRAM_HZ;
          
          if (shouldRecreate) {
            console.log(`Sample rate detected: ${sr}Hz, recreating spectrogram with frequency range 0-${targetMax}Hz (Nyquist: ${nyquistFreq}Hz)`);
            
            // Destroy old spectrogram (it will clean up its own DOM)
            if (spectrogramPluginRef.current) {
              try {
                spectrogramPluginRef.current.destroy?.();
              } catch (e) {
                console.warn('Error destroying old spectrogram:', e);
              }
              spectrogramPluginRef.current = null;
            }
            
            // Create new spectrogram with correct frequency range
            const newSpectrogram = SpectrogramPlugin.create({
              container: spectrogramContainer,
              height: 200,
              labels: true,
              fftSamples: 2048,
              frequencyMax: targetMax,
              frequencyMin: 0,
              scale: 'linear' as const,
            });
            
            // Update the plugin reference
            spectrogramPluginRef.current = newSpectrogram;
            
            // Re-initialize the spectrogram with the WaveSurfer instance
            // Try multiple methods to ensure it's properly connected
            if (newSpectrogram) {
              // Method 1: Try init method if it exists
              type SpectrogramWithInit = typeof newSpectrogram & { init?: (ws: WaveSurfer) => void };
              const spectrogramWithInit = newSpectrogram as SpectrogramWithInit;
              if (spectrogramWithInit.init) {
                try {
                  spectrogramWithInit.init(waveSurferInstance);
                } catch (e) {
                  console.warn('Error calling init on spectrogram:', e);
                }
              }
              
              // Method 2: Try registerPlugin if it exists on WaveSurfer
              type WaveSurferWithRegister = WaveSurfer & { registerPlugin?: (plugin: unknown) => void };
              const wsWithRegister = waveSurferInstance as WaveSurferWithRegister;
              if (wsWithRegister.registerPlugin) {
                try {
                  wsWithRegister.registerPlugin(newSpectrogram);
                } catch (e) {
                  console.warn('Error registering spectrogram plugin:', e);
                }
              }
              
              // Method 3: Force a redraw by seeking to current position
              setTimeout(() => {
                const currentTime = waveSurferInstance.getCurrentTime();
                waveSurferInstance.seekTo(currentTime / waveSurferInstance.getDuration());
              }, 100);
            }
          }
        } else {
          // If sample rate couldn't be detected, ensure initial spectrogram is rendered
          // by forcing a redraw
          setTimeout(() => {
            if (spectrogramPluginRef.current && waveSurferInstance) {
              const currentTime = waveSurferInstance.getCurrentTime();
              const duration = waveSurferInstance.getDuration();
              if (duration > 0) {
                waveSurferInstance.seekTo(currentTime / duration);
              }
            }
          }, 200);
        }
        // Update regions if available
        // Note: clipRegions might be empty initially, but will be updated by the separate useEffect
        // We don't clear/add regions here to avoid race conditions - let the separate useEffect handle it
        
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
            type ContainerWithCleanup = HTMLDivElement & { _hoverCleanup?: () => void };
            (container as ContainerWithCleanup)._hoverCleanup = () => {
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
      // Use the captured container value from the start of the effect
      if (containerForCleanup) {
        type ContainerWithCleanup = HTMLDivElement & { _hoverCleanup?: () => void };
        const containerWithCleanup = containerForCleanup as ContainerWithCleanup;
        if (containerWithCleanup._hoverCleanup) {
          containerWithCleanup._hoverCleanup();
          delete containerWithCleanup._hoverCleanup;
        }
      }
      
      // Destroy plugins in the correct order: spectrogram -> regions -> wavesurfer
      if (spectrogramPluginRef.current) {
        try {
          spectrogramPluginRef.current.destroy?.();
        } catch (e) {
          console.warn('Error destroying spectrogram:', e);
        }
        spectrogramPluginRef.current = null;
      }
      if (regionsPlugin) {
        try {
          regionsPlugin.destroy();
        } catch (e) {
          console.warn('Error destroying regions:', e);
        }
      }
      if (ws) {
        try {
          ws.destroy();
        } catch (e) {
          console.warn('Error destroying wavesurfer:', e);
        }
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
    
    try {
      // Safely clear regions - wrap in try-catch in case regions are already being cleared elsewhere
      regionsPlugin.clearRegions();
    } catch (e) {
      // Regions might already be cleared or in an invalid state, ignore
      console.warn('Error clearing regions (ignored):', e);
    }
    
    // Add new regions
    clipRegions.forEach((r) => {
      try {
        regionsPlugin.addRegion({
          start: r.start,
          end: r.end,
          color: 'rgba(192,132,252,0.18)',
          drag: false,
          resize: false,
        });
      } catch (e) {
        // Region might fail to add if plugin is in invalid state, ignore
        console.warn('Error adding region (ignored):', e);
      }
    });
  }, [clipRegions]);

  // Update clipPredictions ref when clipPredictions state changes
  // This ensures the hover handler always has access to the latest predictions
  useEffect(() => {
    clipPredictionsRef.current = clipPredictions;
    console.log('clipPredictions updated, count:', clipPredictions.length);
  }, [clipPredictions]);

  const togglePlay = useCallback(async () => {
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
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const ws = waveSurferRef.current;
      if (!ws || !audioObjectUrl) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          void togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          const currentTime = ws.getCurrentTime();
          const newTime = Math.max(0, currentTime - 5);
          ws.seekTo(newTime / ws.getDuration());
          break;
        case 'ArrowRight':
          e.preventDefault();
          const currentTime2 = ws.getCurrentTime();
          const duration = ws.getDuration();
          const newTime2 = Math.min(duration, currentTime2 + 5);
          ws.seekTo(newTime2 / duration);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioObjectUrl, togglePlay]);

  // Update playback speed and volume
  useEffect(() => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    
    const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
    if (media) {
      media.playbackRate = playbackSpeed;
      // Volume is handled by the equalizer, but we can also set it on the media element as a fallback
      if (eqAudioContextRef.current && eqSourceNodeRef.current) {
        // Volume is controlled by equalizer, but we can set media volume as backup
        media.volume = volume;
      }
    }
  }, [playbackSpeed, volume]);

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
      setIsPlaying(false); // Reset play state when processing new audio
      
      // Stop any currently playing audio
      const currentWaveSurfer = waveSurferRef.current;
      if (currentWaveSurfer) {
        try {
          currentWaveSurfer.pause();
        } catch {
          // Ignore errors if WaveSurfer is not ready
        }
      }
      
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

        setProcessingStatus(`Analyzing ${spectrograms.length} segment${spectrograms.length > 1 ? 's' : ''}…`);
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

  const handleDownloadPredictions = useCallback(() => {
    if (clipPredictions.length === 0) return;

    const CLIP_DURATION = 12; // seconds per segment
    const segments = clipPredictions.map((result, index) => {
      const startTime = index * CLIP_DURATION;
      const endTime = (index + 1) * CLIP_DURATION;
      const top5 = result.topPredictions.slice(0, 5).map((pred) => ({
        className: pred.className,
        humanReadableName: pred.humanReadableName ?? pred.className,
        confidence: pred.confidence,
        classIndex: pred.classIndex,
      }));

      return {
        segmentIndex: index,
        startTime,
        endTime,
        predictions: top5,
      };
    });

    const jsonData = {
      segments,
      metadata: {
        totalSegments: segments.length,
        segmentDuration: CLIP_DURATION,
        generatedAt: new Date().toISOString(),
      },
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `per-segment-predictions-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    // Use setTimeout to ensure the click event completes before removing
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 100);
  }, [clipPredictions]);

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
      <main aria-label="Bioacoustic Detection and Analysis Application">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-12 pt-12">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/60 px-8 py-10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]" aria-labelledby="page-heading">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(248,113,113,0.12),transparent_25%)]" aria-hidden="true" />
          <div className="relative flex flex-col gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              Live, in-browser bioacoustics detection and identification toolkit
            </div>
            <h1 id="page-heading" className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Bioacoustics ID and Analysis Toolkit
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              Paste a URL or attach audio to analyze. We generate spectrograms and run the{' '}
              <a
                href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5564664"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                PNW-Cnet-5
              </a>{' '}
              model inference (Lesmeister et al., 2025) in your browser using the onnx-runtime js library. The model was trained on the{' '}
              <a
                href="https://zenodo.org/records/10895837"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Avian dawn chorus recordings dataset
              </a>{' '}
              (Weldy et al., 2024) and processes audio in 12-second segments, returning top species predictions with human-readable labels.
            </p>
            <p className="max-w-2xl text-sm text-slate-300">
              Created by{' '}
              <a
                href="https://isaacc.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 font-medium hover:text-emerald-300 underline transition-colors"
              >
                Isaac Corley
              </a>
              .
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch">
            <div className="relative flex flex-col space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between">
                <h2 id="audio-input-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Audio Input
                </h2>
                <div className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setShowHelp(true)}
                    onMouseLeave={() => setShowHelp(false)}
                    onFocus={() => setShowHelp(true)}
                    onBlur={() => setShowHelp(false)}
                    className="rounded-full p-1 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    aria-label="Show help information"
                    aria-expanded={showHelp}
                    aria-haspopup="true"
                  >
                    <Info size={16} aria-hidden="true" />
                  </button>
                  {showHelp && (
                    <div 
                      className="absolute right-0 top-6 z-50 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-xl"
                      role="tooltip"
                      aria-label="Help information"
                    >
                      <p className="mb-2 font-semibold">How to use:</p>
                      <ul className="space-y-1 text-slate-300">
                        <li>• Upload an audio file or paste a URL</li>
                        <li>• Click Process to analyze</li>
                        <li>• Hover over the waveform to see predictions</li>
                        <li>• Use the equalizer to adjust frequencies</li>
                        <li>• Keyboard shortcuts: Space (play/pause), ← → (seek)</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void processAudioFromUrl(audioUrl);
                }}
                aria-label="Audio file upload and processing form"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!model || isProcessing}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 shadow-inner shadow-black/20 transition hover:border-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    title="Upload local file"
                    aria-label="Upload audio file from computer"
                  >
                    <Paperclip size={16} aria-hidden="true" />
                  </button>
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/audio.wav"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    disabled={!model || isProcessing}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner shadow-black/20 outline-none ring-1 ring-transparent transition hover:border-slate-700 focus:border-emerald-400 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Audio file URL"
                    aria-describedby="url-help"
                    aria-invalid={errorMessage ? 'true' : 'false'}
                    required
                  />
                  <span id="url-help" className="sr-only">Enter a URL to an audio file to analyze</span>
                  <button
                    type="submit"
                    disabled={!model || isProcessing}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-medium text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    aria-label="Process audio file for bioacoustic analysis"
                  >
                    Process
                  </button>
                  <button
                    type="button"
                    onClick={handleRandomUrl}
                    disabled={!model || isProcessing || recordingUrls.length === 0}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-medium text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    aria-label="Load random sample audio file"
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

              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Model:</span>
                <div role="status" aria-live="polite" aria-atomic="true">
                  <span className="rounded-full bg-slate-800/80 px-2 py-1 text-xs text-slate-200">
                    {modelStatus}
                  </span>
                </div>
                
                <span className="font-semibold text-slate-100">Processing:</span>
                <div className="flex items-center gap-2" role="status" aria-live="polite" aria-atomic="true">
                  {processingStatus ? (
                    isProcessing && processingProgress !== null ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-emerald-400" aria-hidden="true" />
                        <span className="text-slate-200">{processingStatus}</span>
                        <span className="text-emerald-300 font-medium">{processingProgress}%</span>
                      </>
                    ) : (
                      <span className="text-slate-200">{processingStatus}</span>
                    )
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
                
                <span className="font-semibold text-slate-100">File:</span>
                <span className="text-slate-200">{fileName || <span className="text-slate-400">—</span>}</span>
                
                <span className="font-semibold text-slate-100">Segments:</span>
                <span className="text-slate-200">{batchResult && batchResult.totalClips > 1 ? batchResult.totalClips : <span className="text-slate-400">—</span>}</span>
                
                <span className="font-semibold text-slate-100">Sample Rate:</span>
                <span className="text-slate-200">
                  {audioMetadata?.sampleRate ? `${(audioMetadata.sampleRate / 1000).toFixed(1)} kHz` : <span className="text-slate-400">—</span>}
                </span>
                
                <span className="font-semibold text-slate-100">Duration:</span>
                <span className="text-slate-200">
                  {audioMetadata?.duration ? formatTime(audioMetadata.duration) : <span className="text-slate-400">—</span>}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadPredictions}
                disabled={clipPredictions.length === 0}
                className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-medium text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:text-emerald-200 disabled:hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                aria-label="Download per-segment predictions as JSON file"
              >
                <Download size={16} aria-hidden="true" />
                Download Per-Segment Predictions
              </button>
            </div>

            <section className="w-full flex flex-col justify-self-end space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]" aria-labelledby="equalizer-heading">
              <div className="flex items-center justify-between">
                <h2 id="equalizer-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Equalizer
                </h2>
                <span className="text-[11px] text-slate-300" aria-label="Equalizer range">-40 dB to +40 dB</span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-slate-800/70 bg-slate-950/70 p-3" role="group" aria-label="Equalizer frequency controls">
                {/* Desktop: Vertical sliders */}
                <div className="hidden md:flex items-end gap-3 overflow-x-auto pb-1">
                  {EQ_BANDS.map((band, idx) => (
                    <div key={band} className="flex flex-col items-center gap-1 text-[10px] text-slate-300">
                      <div className="relative flex h-44 w-8 items-center justify-center">
                        <div className="absolute inset-y-2 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-slate-700/70" aria-hidden="true" />
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
                          className="relative z-10 h-44 w-3 appearance-none bg-transparent accent-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          aria-label={`${band >= 1000 ? `${band / 1000} kilohertz` : `${band} hertz`} frequency band. Current gain: ${eqGains[idx] > 0 ? '+' : ''}${eqGains[idx].toFixed(1)} decibels`}
                          aria-valuemin={-40}
                          aria-valuemax={40}
                          aria-valuenow={eqGains[idx]}
                          aria-valuetext={`${eqGains[idx] > 0 ? '+' : ''}${eqGains[idx].toFixed(1)} dB`}
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
                {/* Mobile: Horizontal sliders */}
                <div className="flex md:hidden flex-col gap-2">
                  {EQ_BANDS.map((band, idx) => (
                    <div key={band} className="flex items-center gap-2">
                      <span className="w-12 text-[10px] text-slate-300" aria-hidden="true">{band >= 1000 ? `${band / 1000}k` : band}</span>
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
                        className="flex-1 h-2 appearance-none bg-slate-700 rounded-lg accent-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        aria-label={`${band >= 1000 ? `${band / 1000} kilohertz` : `${band} hertz`} frequency band. Current gain: ${eqGains[idx] > 0 ? '+' : ''}${eqGains[idx].toFixed(1)} decibels`}
                        aria-valuemin={-40}
                        aria-valuemax={40}
                        aria-valuenow={eqGains[idx]}
                        aria-valuetext={`${eqGains[idx] > 0 ? '+' : ''}${eqGains[idx].toFixed(1)} dB`}
                      />
                      <span className="w-10 text-[10px] text-slate-300 text-right">{eqGains[idx] > 0 ? '+' : ''}{eqGains[idx].toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
          <section aria-labelledby="waveform-heading" className="space-y-4">
          <div className="flex items-center justify-between">
              <h2 id="waveform-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Waveform / Spectrogram
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300" role="group" aria-label="Audio playback controls">
                <span aria-live="off" aria-atomic="true">
                  <span className="sr-only">Current time: </span>{formatTime(currentTime)}<span className="sr-only"> of </span> / {formatTime(audioDuration)}
                </span>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!audioObjectUrl || isProcessing}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  aria-label={isPlaying ? 'Pause audio playback' : 'Play audio'}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <div className="flex items-center gap-2">
                  <label htmlFor="playback-speed" className="text-slate-400 text-[10px]">
                    Speed:
                  </label>
                  <select
                    id="playback-speed"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    disabled={!audioObjectUrl}
                    className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Playback speed"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 size={14} className="text-slate-400" aria-hidden="true" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    disabled={!audioObjectUrl}
                    className="w-20 accent-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Volume control"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(volume * 100)}
                    aria-valuetext={`${Math.round(volume * 100)} percent`}
                  />
                  <span className="text-[10px] text-slate-400 w-8" aria-hidden="true">{Math.round(volume * 100)}%</span>
                </div>
              </div>
            </div>
            <div 
              key={audioObjectUrl || 'no-audio'} 
              className="h-[140px] w-full rounded-xl border border-slate-800/70 bg-slate-950/60 relative"
            >
              <div 
                ref={waveContainerRef} 
                className="absolute inset-0"
                suppressHydrationWarning
              />
              {!audioObjectUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <p className="text-sm text-slate-400">Upload or paste a URL to see the waveform</p>
                </div>
              )}
              {audioObjectUrl && isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-emerald-400" />
                </div>
              )}
            </div>
            <div 
              key={audioObjectUrl ? `spec-${audioObjectUrl}` : 'no-spec'} 
              className="h-[200px] w-full rounded-lg border border-slate-800/70 bg-slate-950/60 relative"
            >
              <div 
                ref={spectrogramContainerRef} 
                className="absolute inset-0"
                suppressHydrationWarning
              />
              {!audioObjectUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <p className="text-sm text-slate-400">Upload or paste a URL to see the spectrogram</p>
                </div>
              )}
              {audioObjectUrl && isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-emerald-400" />
                </div>
              )}
            </div>
            <div 
              className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 shadow-inner shadow-black/30"
              role="status"
              aria-live="polite"
              aria-label="Prediction details at cursor position"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>{hoverInfo ? `Segment @ ${formatTime(hoverInfo.time)}` : 'Hover over waveform'}</span>
                <span>Top 3</span>
              </div>
              <div className="mt-1 space-y-1">
                {hoverInfo && !isProcessing ? (
                  hoverInfo.items.map((item, idx) => {
                    const thumbnailUrl = getClassThumbnail(item.className, item.humanReadableName);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbnailUrl}
                              alt={`Thumbnail for ${item.humanReadableName || item.label}`}
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
                  })
                ) : (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between gap-2 animate-pulse">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="h-6 w-6 rounded bg-slate-800/50 flex-shrink-0" />
                          <div className="h-4 bg-slate-800/50 rounded flex-1" />
                        </div>
                        <div className="h-4 w-12 bg-slate-800/50 rounded flex-shrink-0" />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            <section className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.35)]" aria-labelledby="detections-heading">
              <h2 id="detections-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Per-Segment Detections
              </h2>
              <div className="h-56 w-full rounded-xl border border-slate-800/70 bg-slate-950/60 p-2 relative">
                <canvas ref={chartCanvasRef} className="h-full w-full" role="img" aria-label="Bar chart showing maximum probability for each audio segment" />
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading chart data">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-emerald-400" aria-hidden="true" />
                    <span className="sr-only">Loading detection data...</span>
                  </div>
                )}
              </div>
            </section>
          </section>
          <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]" aria-labelledby="results-heading" aria-busy={isProcessing && !classificationResult ? true : undefined}>
            <h2 id="results-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Top-5 Detected Species / Sources
            </h2>
            {isProcessing && !classificationResult ? (
              <div className="space-y-3" role="status" aria-label="Loading detection results">
                <span className="sr-only">Loading species detection results...</span>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 shadow-inner shadow-black/30 animate-pulse" aria-hidden="true">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-700/50" />
                        <div className="h-4 w-32 bg-slate-700/50 rounded" />
                      </div>
                      <div className="h-4 w-12 bg-slate-700/50 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : classificationResult ? (
              <div className="space-y-3">
                <div className="space-y-3" role="list" aria-label="Detected species ranked by confidence">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-300" aria-hidden="true">
                      <span className="flex-1">Species</span>
                      <span className="w-14 text-center">Max Score</span>
                    </div>
                    {classificationResult.topPredictions.slice(0, 5).map((pred, idx) => {
                      const thumbnailUrl = getClassThumbnail(pred.className, pred.humanReadableName);
                      const confidence = ((pred.maxConfidence ?? pred.confidence) * 100).toFixed(2);
                      const speciesName = pred.humanReadableName ?? pred.className;
                      return (
                        <div
                          key={pred.classIndex}
                          className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 shadow-inner shadow-black/30"
                          role="listitem"
                          aria-label={`Rank ${idx + 1}: ${speciesName} detected with ${confidence} percent confidence`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {thumbnailUrl && (
                                <div className="relative group z-10 group-hover:z-50">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={thumbnailUrl}
                                    alt={`Photo of ${pred.humanReadableName ?? pred.className}`}
                                    className="h-10 w-10 rounded-lg object-cover border border-slate-700/50 transition-all duration-200 ease-in-out cursor-pointer group-hover:scale-[2.5] group-hover:shadow-2xl group-hover:border-emerald-400/50"
                                    onError={(e) => {
                                      // Hide image if it fails to load
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {(() => {
                                  // Only make species name a link for bird species, not for non-bird classes
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
                                  
                                  const speciesName = pred.humanReadableName ?? pred.className;
                                  
                                  if (isBird) {
                                    return (
                                      <a
                                        href={`https://www.google.com/search?q=${encodeURIComponent(displayName)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-slate-100 hover:text-emerald-300 underline transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded"
                                        aria-label={`Search for ${speciesName} on Google (opens in new tab)`}
                                      >
                                        {speciesName}
                                      </a>
                                    );
                                  }
                                  
                                  return (
                                    <span className="text-sm font-medium text-slate-100">
                                      {speciesName}
                                    </span>
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
            ) : (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 shadow-inner shadow-black/30 animate-pulse" aria-hidden="true">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-700/50" />
                        <div className="h-4 w-32 bg-slate-700/50 rounded" />
                      </div>
                      <div className="h-4 w-12 bg-slate-700/50 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          {errorMessage && (
              <div 
                className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200 shadow-inner shadow-red-900/40"
                role="alert"
                aria-live="assertive"
              >
                <p>{errorMessage}</p>
              </div>
            )}
          </div>
      </div>
        </main>
      </div>
  );
}

