'use client';

import type { Chart as ChartJS } from 'chart.js';
import Chart from 'chart.js/auto';
import { ChevronDown, ChevronUp, Download, Info, Paperclip, Search, Volume2 } from 'lucide-react';


import { LocationMap } from '@/components/location-map';
import type { InferenceSession } from 'onnxruntime-web';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPluginType from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { AcousticIndices } from './utils/acoustic-indices';
import { audioFileToSpectrograms, preloadEssentia } from './utils/audio-to-spectrogram';
import { getClassThumbnail, getHumanReadableName } from './utils/class-mapper';
import type { FrequencyBandEnergies } from './utils/frequency-bands';
import { extractGPSFromAudio } from './utils/gps-extractor';
import { CLASSES, classifySpectrogramsBatch, type BatchInferenceResult, type InferenceResult } from './utils/inference';
import { loadBioacousticsModel } from './utils/model-loader';

const MODEL_PATH = '/bioacoustics/assets/Final_Model_slim.onnx';
const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
const MAX_SPECTROGRAM_HZ = 22050;

// Helper function to get emerald color class based on confidence percentage
const getConfidenceColorClass = (confidence: number): string => {
  const percentage = confidence * 100;
  if (percentage >= 90) return 'text-emerald-100';
  if (percentage >= 80) return 'text-emerald-200';
  if (percentage >= 70) return 'text-emerald-300';
  if (percentage >= 60) return 'text-emerald-400';
  if (percentage >= 50) return 'text-emerald-500';
  return 'text-slate-400';
};


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
  const [audioMetadata, setAudioMetadata] = useState<{
    sampleRate?: number;
    duration?: number;
    dateTime?: string;
    location?: { lat?: number; lon?: number; name?: string };
  }>({});
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
  const [acousticIndicesData, setAcousticIndicesData] = useState<AcousticIndices[]>([]);
  const [frequencyBandsData, setFrequencyBandsData] = useState<FrequencyBandEnergies[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'aci' | 'adi' | 'ndsi' | 'bi' | 'combined' | 'freq-bands' | 'detections'>('combined');
  const specMaxHzRef = useRef(MAX_SPECTROGRAM_HZ);
  
  // Species gallery state
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState('');
  const [speciesData, setSpeciesData] = useState<Array<{ v5Code: string; commonName: string; thumbnail: string | null }>>([]);
  
  // Temporal analysis toggle state
  const [isTemporalAnalysisExpanded, setIsTemporalAnalysisExpanded] = useState(true);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);
  
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
  // Combined acoustic metrics chart ref - supports both 'line' and 'bar' types
  const metricsChartRef = useRef<HTMLCanvasElement | null>(null);
  const metricsChartInstanceRef = useRef<ChartJS<'line' | 'bar', number[], string> | null>(null);
  const audioBlobUrlsRef = useRef<Set<string>>(new Set());
  const audioUrlCacheRef = useRef<Map<string, { blobUrl: string; file: File }>>(new Map());
  const blobUrlAlreadySetRef = useRef<boolean>(false);
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
      }
    };
    void loadRecordings();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load all species data for the gallery
  useEffect(() => {
    let cancelled = false;
    const loadSpeciesData = async () => {
      try {
        const speciesPromises = CLASSES.map(async (v5Code) => {
          const commonName = await getHumanReadableName(v5Code);
          const thumbnail = getClassThumbnail(v5Code);
          return { v5Code, commonName, thumbnail };
        });
        const species = await Promise.all(speciesPromises);
        if (!cancelled) {
          setSpeciesData(species);
        }
      } catch (error) {
        console.error('Failed to load species data:', error);
      }
    };
    void loadSpeciesData();
    return () => {
      cancelled = true;
    };
  }, []);

  const setupEqualizer = useCallback((ws: WaveSurfer) => {
    if (!ws) return;
    if (eqFiltersRef.current) return;
    
    const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
    if (!media) {
      console.warn('setupEqualizer: Media element not available');
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext is not supported in this browser');
    }
    const ctx = new AudioContextClass();
    eqAudioContextRef.current = ctx;
    
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(media);
    } catch (error) {
      console.warn('Media element already connected to AudioContext:', error);
      ctx.close().catch(console.error);
      eqAudioContextRef.current = null;
      return;
    }
    eqSourceNodeRef.current = source;
    
    const filters = EQ_BANDS.map((band, idx) => {
      const filter = ctx.createBiquadFilter();
      filter.type = band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking';
      filter.Q.value = 1;
      filter.frequency.value = band;
      filter.gain.value = -(eqGainsRef.current[idx] ?? 0);
      return filter;
    });

    let currentNode: AudioNode = source;
    filters.forEach((filter) => {
      currentNode.connect(filter);
      currentNode = filter;
    });
    currentNode.connect(ctx.destination);

    eqFiltersRef.current = filters;
  }, []);

  useEffect(() => {
    const filters = eqFiltersRef.current;
    if (!filters) return;
    filters.forEach((f, idx) => {
      const invertedGain = -eqGains[idx];
      if (f.gain.value !== invertedGain) {
        f.gain.value = invertedGain;
      }
    });
    eqGainsRef.current = eqGains;
  }, [eqGains]);

  useEffect(() => {
    return () => {
      if (eqFiltersRef.current) {
        eqFiltersRef.current.forEach((f) => f.disconnect());
        eqFiltersRef.current = null;
      }
      if (eqSourceNodeRef.current) {
        eqSourceNodeRef.current.disconnect();
        eqSourceNodeRef.current = null;
      }
      const ws = waveSurferRef.current;
      if (ws) {
        const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
        if (media) {
          media.volume = 1;
        }
      }
    };
  }, []);

  useEffect(() => {
    const ctx = chartCanvasRef.current?.getContext('2d');
    if (!ctx) return;

    const cleanupTooltip = () => {
      if (tooltipElementRef.current instanceof HTMLDivElement) {
        const tooltipEl = tooltipElementRef.current;
        if (tooltipEl.isConnected && tooltipEl.parentNode) {
          try {
            tooltipEl.remove();
          } catch (e) {
            console.debug('Tooltip already removed:', e);
          }
        }
        tooltipElementRef.current = null;
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getOrCreateTooltip = (chart: ChartJS) => {
      if (tooltipElementRef.current && !tooltipElementRef.current.isConnected) {
        tooltipElementRef.current = null;
      }
      
      if (!tooltipElementRef.current) {
        cleanupTooltip();
        
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl pointer-events-none';
        tooltipEl.style.opacity = '0';
        tooltipEl.style.position = 'fixed'; // Use fixed instead of absolute
        tooltipEl.style.transform = 'translate(-50%, 0)';
        tooltipEl.style.transition = 'opacity 0.1s';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.zIndex = '1000';
        document.body.appendChild(tooltipEl);
        tooltipElementRef.current = tooltipEl;
      }
      return tooltipElementRef.current;
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
      if (tooltipElementRef.current && !tooltipElementRef.current.isConnected) {
        tooltipElementRef.current = null;
      }
      
      chartInstanceRef.current.data.labels = labels;
      chartInstanceRef.current.data.datasets[0].data = datasetValues;
      chartInstanceRef.current.update('none');
      return;
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
            {
              label: 'Confidence',
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
            title: { display: true, text: 'Confidence' },
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

              const thumbnailUrl = getClassThumbnail(entry.className ?? '');
              const probability = (entry.confidence * 100).toFixed(1);
              
              console.log('[Chart Tooltip]', {
                dataIndex,
                className: entry.className,
                thumbnailUrl,
                speciesName: entry.speciesName,
              });
              
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

              const position = chart.canvas.getBoundingClientRect();
              tooltipEl.style.opacity = '1';
              tooltipEl.style.left = (position.left + tooltip.caretX) + 'px';
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
      if (tooltipElementRef.current instanceof HTMLDivElement) {
        const tooltipEl = tooltipElementRef.current;
        if (tooltipEl.isConnected && tooltipEl.parentNode) {
          try {
            tooltipEl.remove();
          } catch (e) {
            console.debug('Tooltip already removed on unmount:', e);
          }
        }
        tooltipElementRef.current = null;
      }
    };
  }, []);

  // Combined Acoustic Metrics Chart (includes detections bar chart)
  useEffect(() => {
    const ctx = metricsChartRef.current?.getContext('2d');
    if (!ctx) return;

    // Detections mode requires clipPredictions
    if (selectedMetric === 'detections') {
      if (clipConfidenceSeries.length === 0) {
        metricsChartInstanceRef.current?.destroy();
        metricsChartInstanceRef.current = null;
        return;
      }

      const labels = clipConfidenceSeries.map(() => '');
      const datasetValues = clipConfidenceSeries.map(({ confidence }) => confidence);

      if (metricsChartInstanceRef.current) {
        // Check if we need to recreate for type change
        const currentType = (metricsChartInstanceRef.current.config as { type?: string }).type;
        if (currentType !== 'bar') {
          metricsChartInstanceRef.current.destroy();
          metricsChartInstanceRef.current = null;
        } else {
          metricsChartInstanceRef.current.data.labels = labels;
          metricsChartInstanceRef.current.data.datasets[0].data = datasetValues;
          metricsChartInstanceRef.current.update('none');
          return;
        }
      }

      metricsChartInstanceRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Max probability',
            data: datasetValues,
            borderWidth: 1,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderRadius: 6,
            barPercentage: 0.75,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: {
              ticks: { display: false },
              grid: { display: false },
              title: { display: true, text: '12s segments', color: '#94a3b8' },
            },
            y: {
              min: 0.5,
              max: 1,
              ticks: {
                stepSize: 0.1,
                callback: (value) => `${Number(value).toFixed(2)}`,
              },
              title: { display: true, text: 'Confidence', color: '#94a3b8' },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const entry = clipConfidenceSeries[context.dataIndex];
                  const probability = (entry?.confidence ?? 0) * 100;
                  return `${entry?.speciesName ?? `Segment ${context.dataIndex + 1}`}: ${probability.toFixed(1)}%`;
                },
              },
            },
          },
        },
      });
      return;
    }

    // Line chart modes (acoustic indices)
    if (acousticIndicesData.length === 0 || frequencyBandsData.length === 0) {
      metricsChartInstanceRef.current?.destroy();
      metricsChartInstanceRef.current = null;
      return;
    }

    const labels = acousticIndicesData.map((_, i) => `${i + 1}`);
    
    // Prepare datasets based on selected metric
    let datasets: { label: string; data: number[]; borderColor: string; backgroundColor: string; borderWidth: number; fill: boolean; tension: number; pointRadius: number; pointHoverRadius: number }[] = [];
    let yAxisConfig: { beginAtZero?: boolean; min?: number; max?: number; title: { display: boolean; text: string; color?: string } } = { beginAtZero: true, title: { display: true, text: 'Value', color: '#94a3b8' } };

    if (selectedMetric === 'aci') {
      datasets = [{
        label: 'ACI (Acoustic Complexity Index)',
        data: acousticIndicesData.map(d => d.aci),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      }];
      yAxisConfig = { beginAtZero: true, title: { display: true, text: 'ACI Value', color: '#94a3b8' } };
    } else if (selectedMetric === 'adi') {
      datasets = [{
        label: 'ADI (Acoustic Diversity Index)',
        data: acousticIndicesData.map(d => d.adi),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      }];
      yAxisConfig = { min: 0, max: 1, title: { display: true, text: 'ADI (0-1)', color: '#94a3b8' } };
    } else if (selectedMetric === 'ndsi') {
      datasets = [{
        label: 'NDSI (Normalized Difference Soundscape Index)',
        data: acousticIndicesData.map(d => d.ndsi),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      }];
      yAxisConfig = { min: -1, max: 1, title: { display: true, text: 'NDSI (-1 to +1)', color: '#94a3b8' } };
    } else if (selectedMetric === 'bi') {
      datasets = [{
        label: 'BI (Bioacoustic Index)',
        data: acousticIndicesData.map(d => d.bi),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      }];
      yAxisConfig = { beginAtZero: true, title: { display: true, text: 'BI Value', color: '#94a3b8' } };
    } else if (selectedMetric === 'combined') {
      // Normalize all metrics to 0-1 range for comparison
      const aciNorm = acousticIndicesData.map(d => d.aci);
      const maxAci = Math.max(...aciNorm, 1);
      const minAci = Math.min(...aciNorm, 0);
      const aciNormalized = aciNorm.map(v => maxAci === minAci ? 0.5 : (v - minAci) / (maxAci - minAci));

      const ndsiData = acousticIndicesData.map(d => d.ndsi);
      const ndsiNormalized = ndsiData.map(v => (v + 1) / 2); // -1 to 1 → 0 to 1

      const biNorm = acousticIndicesData.map(d => d.bi);
      const maxBi = Math.max(...biNorm, 1);
      const minBi = Math.min(...biNorm, 0);
      const biNormalized = biNorm.map(v => maxBi === minBi ? 0.5 : (v - minBi) / (maxBi - minBi));

      datasets = [
        {
          label: 'ACI (normalized)',
          data: aciNormalized,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: 'ADI',
          data: acousticIndicesData.map(d => d.adi),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: 'NDSI (normalized)',
          data: ndsiNormalized,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: 'BI (normalized)',
          data: biNormalized,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ];
      yAxisConfig = { min: 0, max: 1, title: { display: true, text: 'Normalized Value (0-1)', color: '#94a3b8' } };
    } else if (selectedMetric === 'freq-bands') {
      datasets = [
        {
          label: 'Geophony (< 1 kHz)',
          data: frequencyBandsData.map(d => d.geophony),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: 'Anthrophony (1-2 kHz)',
          data: frequencyBandsData.map(d => d.anthrophony),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: 'Biophony (2-4 kHz)',
          data: frequencyBandsData.map(d => d.biophony),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ];
      yAxisConfig = { beginAtZero: true, title: { display: true, text: 'Energy (normalized)', color: '#94a3b8' } };
    }

    if (metricsChartInstanceRef.current) {
      // Check if we need to recreate for type change (line vs bar)
      const currentType = (metricsChartInstanceRef.current.config as { type?: string }).type;
      if (currentType !== 'line') {
        metricsChartInstanceRef.current.destroy();
        metricsChartInstanceRef.current = null;
      } else {
        metricsChartInstanceRef.current.data.labels = labels;
        metricsChartInstanceRef.current.data.datasets = datasets;
        if (metricsChartInstanceRef.current.options.scales?.y) {
          Object.assign(metricsChartInstanceRef.current.options.scales.y, yAxisConfig);
        }
        metricsChartInstanceRef.current.update('none');
        return;
      }
    }

    metricsChartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            ticks: { display: false },
            grid: { display: false },
            title: { display: true, text: '12s segments', color: '#94a3b8' },
          },
          y: yAxisConfig,
        },
        plugins: {
          legend: {
            display: selectedMetric === 'combined' || selectedMetric === 'freq-bands',
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: { size: 11 },
              color: '#cbd5e1',
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(3)}`,
            },
          },
        },
      },
    });

    return () => {
      metricsChartInstanceRef.current?.destroy();
      metricsChartInstanceRef.current = null;
    };
  }, [acousticIndicesData, frequencyBandsData, selectedMetric, clipConfidenceSeries]);

  // Resize chart when temporal analysis section is expanded/collapsed
  useEffect(() => {
    if (isTemporalAnalysisExpanded && metricsChartInstanceRef.current) {
      // Delay to ensure DOM is updated
      setTimeout(() => {
        metricsChartInstanceRef.current?.resize();
      }, 0);
    }
  }, [isTemporalAnalysisExpanded]);

  useEffect(() => {
    if (
      !audioObjectUrl ||
      !waveContainerRef.current ||
      !spectrogramContainerRef.current
    ) {
      return;
    }
    
    const existingWs = waveSurferRef.current;
    if (existingWs) {
      const media = (existingWs as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
      if (media && media.src === audioObjectUrl) {
        console.log('WaveSurfer already exists for this URL, skipping duplicate creation');
        return;
      }
      console.log('URL changed, will destroy old WaveSurfer in cleanup');
    }
    
    if (waveContainerRef.current?.children.length || spectrogramContainerRef.current?.children.length) {
      console.warn('Containers already have children, cleaning up before creating new WaveSurfer');
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
    
    const currentUrl = audioObjectUrl;
    
    let ws: WaveSurfer | null = null;
    let regionsPlugin: RegionsPluginType | null = null;
    let cancelled = false;
    const containerForCleanup = waveContainerRef.current;
      (async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default;
      const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.esm.js')).default;
      const SpectrogramPlugin = (await import('wavesurfer.js/dist/plugins/spectrogram.esm.js')).default;
      const HoverPlugin = (await import('wavesurfer.js/dist/plugins/hover.esm.js')).default;
      if (cancelled) return;
      regionsPlugin = RegionsPlugin.create();
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
        setTimeout(() => {
          setupEqualizer(waveSurferInstance);
        }, 100);
        const decoded = (waveSurferInstance as unknown as { getDecodedData?: () => AudioBuffer | null }).getDecodedData?.();
        const sr =
          decoded?.sampleRate ??
          ((waveSurferInstance as unknown as { backend?: { buffer?: AudioBuffer | null } }).backend?.buffer?.sampleRate ??
            null);
        
        const duration = waveSurferInstance.getDuration() || 0;
        setAudioMetadata(prev => ({
          ...prev,
          sampleRate: sr && Number.isFinite(sr) ? sr : undefined,
          duration: duration > 0 ? duration : undefined,
        }));
        
        if (sr && Number.isFinite(sr)) {
          const nyquistFreq = sr / 2;
          const targetMax = Math.min(MAX_SPECTROGRAM_HZ, nyquistFreq);
          const previousFreq = specMaxHzRef.current;
          
          specMaxHzRef.current = targetMax;
          
          const shouldRecreate = Math.abs(targetMax - previousFreq) > 1 || previousFreq === MAX_SPECTROGRAM_HZ;
          
          if (shouldRecreate) {
            console.log(`Sample rate detected: ${sr}Hz, recreating spectrogram with frequency range 0-${targetMax}Hz (Nyquist: ${nyquistFreq}Hz)`);
            
            if (spectrogramPluginRef.current) {
              try {
                spectrogramPluginRef.current.destroy?.();
              } catch (e) {
                console.warn('Error destroying old spectrogram:', e);
              }
              spectrogramPluginRef.current = null;
            }
            
            const newSpectrogram = SpectrogramPlugin.create({
              container: spectrogramContainer,
              height: 200,
              labels: true,
              fftSamples: 2048,
              frequencyMax: targetMax,
              frequencyMin: 0,
              scale: 'linear' as const,
            });
            
            spectrogramPluginRef.current = newSpectrogram;
            
            if (newSpectrogram) {
              type SpectrogramWithInit = typeof newSpectrogram & { init?: (ws: WaveSurfer) => void };
              const spectrogramWithInit = newSpectrogram as SpectrogramWithInit;
              if (spectrogramWithInit.init) {
                try {
                  spectrogramWithInit.init(waveSurferInstance);
                } catch (e) {
                  console.warn('Error calling init on spectrogram:', e);
                }
              }
              
              type WaveSurferWithRegister = WaveSurfer & { registerPlugin?: (plugin: unknown) => void };
              const wsWithRegister = waveSurferInstance as WaveSurferWithRegister;
              if (wsWithRegister.registerPlugin) {
                try {
                  wsWithRegister.registerPlugin(newSpectrogram);
                } catch (e) {
                  console.warn('Error registering spectrogram plugin:', e);
                }
              }
              
              setTimeout(() => {
                const currentTime = waveSurferInstance.getCurrentTime();
                waveSurferInstance.seekTo(currentTime / waveSurferInstance.getDuration());
              }, 100);
            }
          }
        } else {
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
        
        type WaveSurferWithHover = WaveSurfer & {
          on(event: 'hover', callback: (time: number) => void): void;
        };
        type HoverPluginWithEvents = typeof hoverPlugin & {
          on(event: 'hover', callback: (time: number) => void): void;
          subscribe?: (event: string, callback: (time: number) => void) => void;
        };
        
        if (hoverHandlerRef.current) {
          try {
            (waveSurferInstance as WaveSurferWithHover).on('hover', hoverHandlerRef.current);
            console.log('Hover handler registered on WaveSurfer instance');
          } catch (e) {
            console.warn('Failed to register hover on WaveSurfer:', e);
          }
          
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
          
          if (eqSourceNodeRef.current && eqFiltersRef.current && eqFiltersRef.current.length > 0) {
            const lastFilter = eqFiltersRef.current[eqFiltersRef.current.length - 1];
            console.log('AudioContext state:', eqAudioContextRef.current.state);
            console.log('Source node:', eqSourceNodeRef.current);
            console.log('Last filter:', lastFilter);
            console.log('Destination:', eqAudioContextRef.current.destination);
            
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
      if (containerForCleanup) {
        type ContainerWithCleanup = HTMLDivElement & { _hoverCleanup?: () => void };
        const containerWithCleanup = containerForCleanup as ContainerWithCleanup;
        if (containerWithCleanup._hoverCleanup) {
          containerWithCleanup._hoverCleanup();
          delete containerWithCleanup._hoverCleanup;
        }
      }
      
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
      if (eqFiltersRef.current) {
        eqFiltersRef.current.forEach((f) => f.disconnect());
        eqFiltersRef.current = null;
      }
      if (eqSourceNodeRef.current) {
        eqSourceNodeRef.current.disconnect();
        eqSourceNodeRef.current = null;
      }
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
    };
  }, [audioObjectUrl, setupEqualizer]); // Only recreate WaveSurfer when audioObjectUrl changes

  useEffect(() => {
    const urlsToCleanup = audioBlobUrlsRef.current;
    return () => {
      urlsToCleanup.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
        }
      });
      urlsToCleanup.clear();
    };
  }, []);

  useEffect(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin) return;
    
    try {
      regionsPlugin.clearRegions();
    } catch (e) {
      console.warn('Error clearing regions (ignored):', e);
    }
    
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
        console.warn('Error adding region (ignored):', e);
      }
    });
  }, [clipRegions]);

  useEffect(() => {
    clipPredictionsRef.current = clipPredictions;
    console.log('clipPredictions updated, count:', clipPredictions.length);
  }, [clipPredictions]);

  const togglePlay = useCallback(async () => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    
    if (eqAudioContextRef.current) {
      if (eqAudioContextRef.current.state === 'suspended') {
        try {
          await eqAudioContextRef.current.resume();
          console.log('AudioContext resumed in togglePlay. State:', eqAudioContextRef.current.state);
        } catch (error) {
          console.error('Failed to resume AudioContext in togglePlay:', error);
        }
      }
      
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  useEffect(() => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    
    const media = (ws as unknown as { getMediaElement?: () => HTMLMediaElement | null }).getMediaElement?.();
    if (media) {
      media.playbackRate = playbackSpeed;
      if (eqAudioContextRef.current && eqSourceNodeRef.current) {
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
      
      const currentWaveSurfer = waveSurferRef.current;
      if (currentWaveSurfer) {
        try {
          currentWaveSurfer.pause();
        } catch {
        }
      }
      
      const currentGains = [...eqGainsRef.current];
      const targetGains = EQ_BANDS.map(() => 0);
      const duration = 300; // milliseconds
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
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
          setEqGains(targetGains);
          eqGainsRef.current = targetGains;
        }
      };
      
      requestAnimationFrame(animate);

      try {
        if (!blobUrlAlreadySetRef.current) {
          const objectUrl = URL.createObjectURL(file);
          audioBlobUrlsRef.current.add(objectUrl);
          fileCacheRef.current.set(objectUrl, file); // Keep File alive by blob URL
          setAudioObjectUrl(objectUrl);
        }
        blobUrlAlreadySetRef.current = false;
        
        // Extract GPS coordinates independently
        setProcessingStatus('Extracting metadata…');
        const gpsCoordinates = await extractGPSFromAudio(file);
        if (gpsCoordinates) {
          setAudioMetadata(prev => ({
            ...prev,
            location: {
              lat: gpsCoordinates.lat,
              lon: gpsCoordinates.lon,
              name: gpsCoordinates.name,
            },
          }));
          console.log('GPS coordinates extracted:', gpsCoordinates);
        } else {
          // Clear location if no GPS found
          setAudioMetadata(prev => ({
            ...prev,
            location: undefined,
          }));
        }
        
        setProcessingStatus('Generating spectrograms…');
        
        const spectrogramResult = await audioFileToSpectrograms(
          file,
          {
            width: 1000,
            height: 257,
            sampleRate: 8000,
            duration: 12,
            dynamicRange: 90,
          }
        );

        if (spectrogramResult.spectrograms.length === 0) {
          throw new Error('No spectrograms generated from audio file');
        }

        // Store acoustic metrics
        setAcousticIndicesData(spectrogramResult.acousticIndices);
        setFrequencyBandsData(spectrogramResult.frequencyBands);

        setProcessingStatus(`Analyzing ${spectrogramResult.spectrograms.length} segment${spectrogramResult.spectrograms.length > 1 ? 's' : ''}…`);
        setProcessingProgress(0);
        
        const batchResult = await classifySpectrogramsBatch(
          model,
          spectrogramResult.spectrograms,
          (current, total) => {
            requestAnimationFrame(() => {
              const percentage = Math.round((current / total) * 100);
              setProcessingProgress(percentage);
            });
          }
        );

        setBatchResult(batchResult);
        setClipPredictions(batchResult.results);
        const clipDuration = 12;
        const totalDuration = spectrogramResult.spectrograms.length * clipDuration;
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
          const blobUrl = URL.createObjectURL(file);
          audioBlobUrlsRef.current.add(blobUrl);
          fileCacheRef.current.set(blobUrl, file); // Keep File alive by blob URL
          cached = { blobUrl, file };
          audioUrlCacheRef.current.set(url, cached);
        }
        
        setFileName(cached.file.name);
        setAudioObjectUrl(cached.blobUrl);
        blobUrlAlreadySetRef.current = true; // Signal that blob URL is already set
        
        await new Promise(resolve => setTimeout(resolve, 50));
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

      // Add acoustic indices if available
      const acousticIndices = acousticIndicesData[index] || null;
      
      // Add frequency band energies if available
      const frequencyBands = frequencyBandsData[index] || null;

      return {
        segmentIndex: index,
        startTime,
        endTime,
        predictions: top5,
        acousticIndices,
        frequencyBands,
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
    a.download = `predictions-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 100);
  }, [clipPredictions, acousticIndicesData, frequencyBandsData]);

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
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gradient-to-b from-slate-950 via-slate-930 to-slate-950 text-slate-100' : 'bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 text-slate-900'}`}>
      <main aria-label="AI Bioacoustics Analysis Application">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-12 pt-12">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/60 px-6 py-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]" aria-labelledby="page-heading">
          {/* Theme Toggle Button - Top Right */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`absolute top-3 right-3 z-10 rounded-lg border p-1.5 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
              isDarkMode
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '🌙' : '☀️'}
          </button>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(248,113,113,0.12),transparent_25%)]" aria-hidden="true" />
          <div className="relative flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex flex-col gap-3 md:max-w-[65%]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              Live, in-browser AI-powered bioacoustics toolkit
            </div>
            <h1 id="page-heading" className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              AI Bioacoustics Analysis Toolkit
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              Upload Audio to Analyze Bird Calls using the{' '}
              <a
                href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5564664"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                PNW-Cnet v5
              </a>{' '}
              model (Lesmeister et al., 2025) trained on 824,120 labeled spectrograms to detect 135 sonotypes (see gallery below). Inference is performed in the browser using the onnx-runtime js library.
            </p>
            <p className="text-sm text-slate-300">
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
            <div className="hidden md:flex md:items-center md:justify-center md:flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/bioacoustics/assets/logo.png" 
                alt="AI Bioacoustics Analysis Toolkit Logo" 
                className="w-32 h-32 object-contain"
              />
            </div>
          </div>
        </section>

        {/* Sonotype Gallery Section */}
        <section className="rounded-2xl border border-slate-800/60 bg-slate-950/80 p-3 shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setIsGalleryExpanded(!isGalleryExpanded)}
            className="flex w-full items-center justify-between text-left transition-colors hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1"
            aria-expanded={isGalleryExpanded}
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Sonotype Gallery
            </h2>
            {isGalleryExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {isGalleryExpanded && (
            <div className="mt-4 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search species by name..."
                  value={speciesSearch}
                  onChange={(e) => setSpeciesSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2 pl-10 pr-4 text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Gallery Grid */}
              <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {speciesData
                    .filter((species) =>
                      species.commonName.toLowerCase().includes(speciesSearch.toLowerCase()) ||
                      species.v5Code.toLowerCase().includes(speciesSearch.toLowerCase())
                    )
                    .map((species) => (
                    <div
                      key={species.v5Code}
                      className="group relative flex flex-col items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 shadow-md transition-all hover:border-emerald-500/50 hover:bg-slate-900/80 hover:shadow-xl hover:z-10"
                    >
                      {species.thumbnail ? (
                        <img
                          src={species.thumbnail}
                          alt={species.commonName}
                          className="h-16 w-16 rounded-md object-cover shadow-sm transition-all duration-200 group-hover:h-24 group-hover:w-24 group-hover:shadow-lg"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-slate-800/50 text-slate-500 transition-all duration-200 group-hover:h-24 group-hover:w-24">
                          <Volume2 className="h-6 w-6 group-hover:h-8 group-hover:w-8 transition-all" />
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-[10px] font-medium text-slate-100 line-clamp-2 leading-tight">
                          {species.commonName}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {species.v5Code}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* No results message */}
              {speciesSearch && speciesData.filter((species) =>
                species.commonName.toLowerCase().includes(speciesSearch.toLowerCase()) ||
                species.v5Code.toLowerCase().includes(speciesSearch.toLowerCase())
              ).length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  No species found matching &quot;{speciesSearch}&quot;
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch">
            <div className="relative flex flex-col space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 id="audio-input-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                    Audio Input
                  </h2>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
                    <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300">
                      <strong className="text-slate-200">How to use:</strong>
                      <ul className="space-y-1 mt-2">
                        <li>• Upload an audio file or paste a URL</li>
                        <li>• Click Process to analyze</li>
                        <li>• Hover over the waveform to see predictions</li>
                        <li>• Use the equalizer to adjust frequencies</li>
                        <li>• Keyboard shortcuts: Space (play/pause), ← → (seek)</li>
                      </ul>
                    </div>
                  </div>
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
                    className="group relative rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-emerald-200 shadow-inner shadow-black/20 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    title="Upload local file"
                    aria-label="Upload audio file from computer"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip size={16} aria-hidden="true" />
                      <span className="text-sm font-medium">Upload</span>
                    </div>
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

              <div className="flex gap-4">
                <div className="flex-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-slate-300">
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
                  
                  <span className="font-semibold text-slate-100">Location:</span>
                  <span className="text-slate-200">
                    {audioMetadata?.location?.lat !== undefined && audioMetadata.location?.lon !== undefined
                      ? `${audioMetadata.location.lat.toFixed(6)}, ${audioMetadata.location.lon.toFixed(6)}`
                      : <span className="text-slate-400">—</span>
                    }
                  </span>
                </div>
                
                {audioMetadata?.location?.lat !== undefined && audioMetadata.location?.lon !== undefined && (
                  <div className="flex-shrink-0">
                    <LocationMap
                      lat={audioMetadata.location.lat}
                      lon={audioMetadata.location.lon}
                      className="h-32 w-32"
                    />
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleDownloadPredictions}
                disabled={clipPredictions.length === 0}
                className="w-full md:absolute md:bottom-4 md:right-4 md:w-auto flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-medium text-emerald-200 shadow-inner shadow-black/30 transition hover:border-emerald-300 hover:text-emerald-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:text-emerald-200 disabled:hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                aria-label="Download predictions and acoustic metrics as JSON file"
              >
                <Download size={16} aria-hidden="true" />
                <span className="hidden md:inline">Download Predictions</span>
                <span className="md:hidden">Download</span>
              </button>
            </div>

            <section className="w-full flex flex-col justify-self-end space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.4)]" aria-labelledby="equalizer-heading">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 id="equalizer-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                    Equalizer
                  </h2>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
                    <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300">
                      <strong className="text-slate-200">Audio Equalizer:</strong>
                      <p className="mt-2">An equalizer (EQ) allows you to adjust the volume of specific frequency ranges. Use it to:</p>
                      <ul className="space-y-1 mt-2">
                        <li>• <strong>Boost frequencies</strong> where bird calls occur (1-8 kHz)</li>
                        <li>• <strong>Reduce low frequencies</strong> to minimize background noise (wind, traffic)</li>
                        <li>• <strong>Enhance clarity</strong> of specific vocalizations by adjusting individual bands</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-slate-300" aria-label="Equalizer range">-40 dB to +40 dB</span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-slate-800/70 bg-slate-950/70 p-3" role="group" aria-label="Equalizer frequency controls">
                {/* Desktop: Vertical sliders */}
                <div className="hidden md:flex items-end gap-3 overflow-x-auto pb-1">
                  {EQ_BANDS.map((band, idx) => (
                    <div key={band} className="flex flex-col items-center gap-1 text-xs text-slate-300">
                      <div className="relative flex h-48 w-8 items-center justify-center">
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
                          className="relative z-10 h-48 w-3 appearance-none bg-transparent accent-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                      <span aria-label={`${band >= 1000 ? `${band / 1000} kilohertz` : `${band} hertz`}`}>{band >= 1000 ? `${band / 1000}k` : band}</span>
                    </div>
                  ))})
                </div>
                {/* Mobile: Horizontal sliders */}
                <div className="flex md:hidden flex-col gap-2">
                  {EQ_BANDS.filter(band => band <= 4000).map((band, idx) => (
                    <div key={band} className="flex items-center gap-2">
                      <span className="w-12 text-xs text-slate-300" aria-label={`${band >= 1000 ? `${band / 1000} kilohertz` : `${band} hertz`}`}>{band >= 1000 ? `${band / 1000}k` : band}</span>
                      <input
                        type="range"
                        min={40}
                        max={-40}
                        step={0.5}
                        value={-eqGains[idx]}
                        onChange={(e) => {
                          const next = -Number(e.target.value);
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
              <div className="flex items-center gap-2">
                <h2 id="waveform-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Waveform / Spectrogram
                </h2>
                <div className="group relative">
                  <Info className="h-4 w-4 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
                  <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-80 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300">
                    <strong className="text-slate-200">Visualization Guide:</strong>
                    <ul className="space-y-1 mt-2">
                      <li>• <strong>Top:</strong> Time-series waveform showing audio amplitude over time</li>
                      <li>• <strong>Bottom:</strong> Spectrogram displaying frequency content (darker = less energy, brighter = more energy)</li>
                      <li>• <strong>Bird frequencies:</strong> Most bird calls/songs occur between 1-8 kHz</li>
                      <li>• <strong>Hover:</strong> Move your cursor over the waveform to see the top detected species at that time point</li>
                    </ul>
                  </div>
                </div>
              </div>
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
                <div className="hidden md:flex items-center gap-2">
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
                    const thumbnailUrl = getClassThumbnail(item.className);
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
                          )}                          <span className="truncate">{item.label}</span>
                        </div>
                        <span className={`flex-shrink-0 ${getConfidenceColorClass(item.confidence)}`}>{(item.confidence * 100).toFixed(1)}%</span>
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

          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]" aria-labelledby="results-heading" aria-busy={isProcessing && !classificationResult ? true : undefined}>
            {/* Top-5 Detected Species moved to top */}
            <div className="flex items-center gap-2">
              <h2 id="results-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                Top-5 Detected Species
              </h2>
              <div className="group relative">
                <Info className="h-4 w-4 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
                <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300">
                  Maximum detection confidence for each 12-second audio segment. Shows which species were detected with highest probability across the recording timeline.
                </div>
              </div>
            </div>
            
            {/* Per-Segment Detection Chart */}
            {clipPredictions.length > 0 && (
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                <div className="relative h-32">
                  <canvas ref={chartCanvasRef} className="h-full w-full" role="img" aria-label="Bar chart showing detection confidence for each 12-second segment" />
                </div>
              </div>
            )}
            
            {isProcessing && !classificationResult ? (
              <div className="space-y-1.5" role="status" aria-label="Loading detection results">
                <span className="sr-only">Loading species detection results...</span>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-1.5 shadow-inner shadow-black/30 animate-pulse" aria-hidden="true">
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
              <div className="space-y-1.5">
                <div className="space-y-1.5" role="list" aria-label="Detected species ranked by confidence">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-300" aria-hidden="true">
                      <span className="flex-1">Species</span>
                      <span className="w-14 text-center">Max Score</span>
                    </div>
                    {classificationResult.topPredictions.slice(0, 5).map((pred, idx) => {
                      const thumbnailUrl = getClassThumbnail(pred.className);
                      const confidence = ((pred.maxConfidence ?? pred.confidence) * 100).toFixed(1);
                      const speciesName = pred.humanReadableName ?? pred.className;
                      return (
                        <div
                          key={pred.classIndex}
                          className="flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-1.5 shadow-inner shadow-black/30"
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
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              {pred.humanReadableName && pred.humanReadableName !== pred.className && (
                                <span className="text-xs font-mono text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                                  {pred.className}
                                </span>
                              )}
                              <div className="flex items-center gap-2">
                                {(() => {
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
                            <span className={`w-14 text-right text-sm font-semibold ${getConfidenceColorClass(pred.maxConfidence ?? pred.confidence)}`}>
                              {((pred.maxConfidence ?? pred.confidence) * 100).toFixed(1)}%
                            </span>
                          </div>
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

          {/* Temporal Analysis Section - Moved to bottom and made toggleable */}
          <section className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-[0_15px_50px_rgba(0,0,0,0.4)]" aria-labelledby="acoustic-metrics-heading">
            <button
              onClick={() => setIsTemporalAnalysisExpanded(!isTemporalAnalysisExpanded)}
              className="flex w-full items-center justify-between text-left transition-colors hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
              aria-expanded={isTemporalAnalysisExpanded}
            >
              <div className="flex items-center gap-2">
                <h2 id="acoustic-metrics-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Temporal Analysis
                </h2>
                <div className="group relative" onClick={(e) => e.stopPropagation()}>
                  <Info className="h-4 w-4 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
                  <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300">
                    <strong className="text-slate-200">Note:</strong> Due to 8 kHz sample rate, frequency analysis is capped at 4 kHz (Nyquist frequency). Full biophony range (2-8 kHz) requires higher sample rates.
                  </div>
                </div>
              </div>
              {isTemporalAnalysisExpanded ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {isTemporalAnalysisExpanded && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Species detections, ecological metrics, and frequency band analysis over time. Select a view to explore detection patterns and habitat quality indicators.
                </p>
                
                {isProcessing && acousticIndicesData.length === 0 && clipPredictions.length === 0 ? (
                  <>
                    {/* Skeleton Loading State */}
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-8 w-32 rounded-lg bg-slate-800/50 animate-pulse" />
                      ))}
                    </div>
                    
                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 p-3 h-16 animate-pulse" />
                    
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                      <div className="h-64 w-full rounded bg-slate-800/50 animate-pulse flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-emerald-400" />
                          <span className="text-xs text-slate-400">Computing acoustic indices...</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3 space-y-2">
                          <div className="h-3 w-16 bg-slate-800/50 rounded animate-pulse" />
                          <div className="h-6 w-20 bg-slate-800/50 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (acousticIndicesData.length > 0 || clipPredictions.length > 0) ? (
                  <>
                    {/* Metric Selector Tabs */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedMetric('combined')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedMetric === 'combined'
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-950/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        aria-pressed={selectedMetric === 'combined'}
                        disabled={acousticIndicesData.length === 0}
                      >
                        Acoustic Indices
                      </button>
                      <button
                        onClick={() => setSelectedMetric('freq-bands')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedMetric === 'freq-bands'
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-950/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        aria-pressed={selectedMetric === 'freq-bands'}
                        disabled={frequencyBandsData.length === 0}
                      >
                        Frequency Bands
                      </button>
                      <button
                        onClick={() => setSelectedMetric('aci')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedMetric === 'aci'
                            ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                            : 'bg-slate-950/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        aria-pressed={selectedMetric === 'aci'}
                        disabled={acousticIndicesData.length === 0}
                      >
                        ACI
                      </button>
                      <button
                        onClick={() => setSelectedMetric('adi')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedMetric === 'adi'
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-950/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        aria-pressed={selectedMetric === 'adi'}
                        disabled={acousticIndicesData.length === 0}
                      >
                        ADI
                      </button>
                      <button
                        onClick={() => setSelectedMetric('ndsi')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedMetric === 'ndsi'
                            ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                            : 'bg-slate-950/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        aria-pressed={selectedMetric === 'ndsi'}
                        disabled={acousticIndicesData.length === 0}
                      >
                        NDSI
                      </button>
                      <button
                        onClick={() => setSelectedMetric('bi')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedMetric === 'bi'
                            ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                            : 'bg-slate-950/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        aria-pressed={selectedMetric === 'bi'}
                        disabled={acousticIndicesData.length === 0}
                      >
                        BI
                      </button>
                    </div>

                    {/* Metric Description */}
                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 p-3 text-xs text-slate-300">
                      {selectedMetric === 'combined' && (
                        <>
                          <strong>Acoustic Indices Combined:</strong> Normalized view of all four acoustic indices for easy comparison. 
                          Values are scaled to 0-1 range. Look for patterns across multiple metrics to assess ecosystem health.
                        </>
                      )}
                      {selectedMetric === 'freq-bands' && (
                        <>
                          <strong>Frequency Band Analysis:</strong> Energy distribution across ecological ranges. 
                          <span className="text-indigo-300"> Geophony</span> (wind/rain), 
                          <span className="text-red-300"> Anthrophony</span> (human noise), 
                          <span className="text-emerald-300"> Biophony</span> (bird calls).
                        </>
                      )}
                      {selectedMetric === 'aci' && (
                        <>
                          <strong>ACI (Acoustic Complexity Index):</strong> Measures sound intensity variability. 
                          Higher values indicate more complex soundscapes with bird activity.
                        </>
                      )}
                      {selectedMetric === 'adi' && (
                        <>
                          <strong>ADI (Acoustic Diversity Index):</strong> Shannon entropy across frequency bins (0-1). 
                          Higher values indicate even distribution of sound energy, suggesting biodiverse communities.
                        </>
                      )}
                      {selectedMetric === 'ndsi' && (
                        <>
                          <strong>NDSI (Normalized Difference Soundscape Index):</strong> Ratio of biological to human sounds (-1 to +1). 
                          Positive values indicate natural soundscapes; negative values indicate human noise pollution.
                        </>
                      )}
                      {selectedMetric === 'bi' && (
                        <>
                          <strong>BI (Bioacoustic Index):</strong> Total sound energy in bird frequency range (2-4 kHz). 
                          Higher values suggest more bird activity and abundance.
                        </>
                      )}
                    </div>

                    {/* Chart */}
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                      <div className="h-64 w-full">
                        <canvas ref={metricsChartRef} className="h-full w-full" role="img" aria-label={`Line chart showing ${selectedMetric} over time`} />
                      </div>
                    </div>

                    {/* Summary Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {selectedMetric === 'aci' && acousticIndicesData.length > 0 && (
                        <>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mean ACI</div>
                            <div className="text-lg font-semibold text-blue-300">
                              {(acousticIndicesData.reduce((sum, d) => sum + d.aci, 0) / acousticIndicesData.length).toFixed(2)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Max ACI</div>
                            <div className="text-lg font-semibold text-blue-300">
                              {Math.max(...acousticIndicesData.map(d => d.aci)).toFixed(2)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Min ACI</div>
                            <div className="text-lg font-semibold text-blue-300">
                              {Math.min(...acousticIndicesData.map(d => d.aci)).toFixed(2)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Std Dev</div>
                            <div className="text-lg font-semibold text-blue-300">
                              {(() => {
                                const values = acousticIndicesData.map(d => d.aci);
                                const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
                                const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
                                return Math.sqrt(variance).toFixed(2);
                              })()}
                            </div>
                          </div>
                        </>
                      )}
                      {selectedMetric === 'adi' && acousticIndicesData.length > 0 && (
                        <>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mean ADI</div>
                            <div className="text-lg font-semibold text-emerald-300">
                              {(acousticIndicesData.reduce((sum, d) => sum + d.adi, 0) / acousticIndicesData.length).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Max ADI</div>
                            <div className="text-lg font-semibold text-emerald-300">
                              {Math.max(...acousticIndicesData.map(d => d.adi)).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Min ADI</div>
                            <div className="text-lg font-semibold text-emerald-300">
                              {Math.min(...acousticIndicesData.map(d => d.adi)).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Diversity</div>
                            <div className="text-lg font-semibold text-emerald-300">
                              {acousticIndicesData.reduce((sum, d) => sum + d.adi, 0) / acousticIndicesData.length > 0.6 ? 'High' : 
                               acousticIndicesData.reduce((sum, d) => sum + d.adi, 0) / acousticIndicesData.length > 0.4 ? 'Medium' : 'Low'}
                            </div>
                          </div>
                        </>
                      )}
                      {selectedMetric === 'ndsi' && acousticIndicesData.length > 0 && (
                        <>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mean NDSI</div>
                            <div className="text-lg font-semibold text-orange-300">
                              {(acousticIndicesData.reduce((sum, d) => sum + d.ndsi, 0) / acousticIndicesData.length).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Max NDSI</div>
                            <div className="text-lg font-semibold text-orange-300">
                              {Math.max(...acousticIndicesData.map(d => d.ndsi)).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Min NDSI</div>
                            <div className="text-lg font-semibold text-orange-300">
                              {Math.min(...acousticIndicesData.map(d => d.ndsi)).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Soundscape</div>
                            <div className="text-lg font-semibold text-orange-300">
                              {acousticIndicesData.reduce((sum, d) => sum + d.ndsi, 0) / acousticIndicesData.length > 0.2 ? 'Natural' : 
                               acousticIndicesData.reduce((sum, d) => sum + d.ndsi, 0) / acousticIndicesData.length > -0.2 ? 'Mixed' : 'Impacted'}
                            </div>
                          </div>
                        </>
                      )}
                      {selectedMetric === 'bi' && acousticIndicesData.length > 0 && (
                        <>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mean BI</div>
                            <div className="text-lg font-semibold text-purple-300">
                              {(acousticIndicesData.reduce((sum, d) => sum + d.bi, 0) / acousticIndicesData.length).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Max BI</div>
                            <div className="text-lg font-semibold text-purple-300">
                              {Math.max(...acousticIndicesData.map(d => d.bi)).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Min BI</div>
                            <div className="text-lg font-semibold text-purple-300">
                              {Math.min(...acousticIndicesData.map(d => d.bi)).toFixed(3)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Bird Activity</div>
                            <div className="text-lg font-semibold text-purple-300">
                              {acousticIndicesData.reduce((sum, d) => sum + d.bi, 0) / acousticIndicesData.length > 0.3 ? 'High' : 
                               acousticIndicesData.reduce((sum, d) => sum + d.bi, 0) / acousticIndicesData.length > 0.15 ? 'Medium' : 'Low'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Empty State Placeholder */}
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-8">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="rounded-full bg-slate-800/50 p-4">
                          <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-300">No Temporal Data Available</p>
                          <p className="text-xs text-slate-500 max-w-md">
                            Upload an audio file to see species detections, acoustic indices, and frequency analysis over time.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
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

