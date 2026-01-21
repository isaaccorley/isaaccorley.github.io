import type { Metadata } from "next";
import { ArrowRight, Database, Target, Wrench } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Earth Embeddings as Products",
  description:
    "Seven Earth embedding products. Zero interoperability. A taxonomy, a critique, and a TorchGeo fix.",
};

const taxonomyLayers = [
  {
    title: "Data",
    subtitle: "Embeddings",
    icon: Database,
    items: ["Location embeddings", "Patch embeddings", "Pixel embeddings"],
  },
  {
    title: "Tools",
    subtitle: "Analysis frameworks",
    icon: Wrench,
    items: ["Benchmarks", "Intrinsic dimension", "Open challenges"],
  },
  {
    title: "Value",
    subtitle: "Downstream use",
    icon: Target,
    items: ["Mapping", "Retrieval", "Time-series analytics"],
  },
];

// Product data with file size metadata
const productRows = [
  {
    name: "Clay",
    kind: "Patch",
    spatial: "5.12 km",
    temporal: "Snapshot",
    dims: 768,
    dtype: "float32",
    bytesPerElement: 4,
    patchKm2: 26.2, // 5.12 * 5.12
    license: "ODC-By-1.0",
  },
  {
    name: "Major TOM",
    kind: "Patch",
    spatial: "2.14–3.56 km",
    temporal: "Snapshot",
    dims: 2048,
    dtype: "float32",
    bytesPerElement: 4,
    patchKm2: 9.0, // ~3km avg squared
    license: "CC-BY-SA-4.0",
  },
  {
    name: "Earth Index",
    kind: "Patch",
    spatial: "320 m",
    temporal: "Snapshot",
    dims: 384,
    dtype: "float32",
    bytesPerElement: 4,
    patchKm2: 0.1024, // 0.32 * 0.32
    license: "CC-BY-4.0",
  },
  {
    name: "Copernicus-Embed",
    kind: "Patch",
    spatial: "0.25°",
    temporal: "Annual",
    dims: 768,
    dtype: "float32",
    bytesPerElement: 4,
    patchKm2: 625, // ~25km * 25km at mid-latitudes
    license: "CC-BY-4.0",
  },
  {
    name: "Presto",
    kind: "Pixel",
    spatial: "10 m",
    temporal: "Annual",
    dims: 128,
    dtype: "uint16",
    bytesPerElement: 2,
    pixelResM: 10,
    license: "CC-BY-4.0",
  },
  {
    name: "Tessera",
    kind: "Pixel",
    spatial: "10 m",
    temporal: "Annual",
    dims: 128,
    dtype: "int8",
    bytesPerElement: 1,
    pixelResM: 10,
    license: "CC-BY-4.0",
  },
  {
    name: "Google Satellite",
    kind: "Pixel",
    spatial: "10 m",
    temporal: "Annual",
    dims: 64,
    dtype: "int8",
    bytesPerElement: 1,
    pixelResM: 10,
    license: "CC-BY-4.0",
  },
];

// AOI scales for file size comparison
const aoiScales = [
  { name: "City", km2: 1_000, example: "San Francisco" },
  { name: "Country", km2: 1_000_000, example: "Egypt" },
  { name: "Continent", km2: 30_000_000, example: "Africa" },
];

// Compute file size for a product at a given AOI
function computeFileSize(product: (typeof productRows)[0], aoiKm2: number): number {
  if (product.kind === "Patch") {
    const patchKm2 = product.patchKm2 ?? 1;
    const numPatches = aoiKm2 / patchKm2;
    return numPatches * product.dims * product.bytesPerElement;
  } else {
    // Pixel: 10m resolution = 10,000 pixels per km²
    const pixelsPerKm2 = 1_000_000 / (product.pixelResM ?? 10) ** 2;
    const numPixels = aoiKm2 * pixelsPerKm2;
    return numPixels * product.dims * product.bytesPerElement;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e15) return `${(bytes / 1e15).toFixed(1)} PB`;
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

const brokenPoints = [
  "Five platforms, five formats, zero interop. Source Cooperative, Hugging Face, Earth Engine, private servers, bespoke repos — pick your poison.",
  "Metadata ranges from incomplete to actively wrong. Yes, upside-down rasters shipped to production.",
  "Reproducibility is a joke: unmaintained repos, no tests, source data that drifts without notice.",
  "Licensing is a minefield. Good luck comparing products without a lawyer on retainer.",
];

const futurePrinciples = [
  "Stop over-indexing on Sentinel-1/2. The oceans, atmosphere, and hyperspectral exist too.",
  "Cloud-native formats are table stakes: GeoParquet, COG, GeoZarr. Pick one and commit.",
  "Benchmarks must ship with models. Private benchmarks are a tax on the entire field.",
  "Embeddings need provenance and uncertainty quantification — not just vibes and vectors.",
];

const torchGeoSnippet = `from torchgeo.datasets import EarthIndexEmbeddings, Sentinel2
from torchgeo.models import ViTSmall14_DINOv2_Weights, vit_small_patch14_dinov2
from torch.nn import CosineSimilarity

model = vit_small_patch14_dinov2(
    ViTSmall14_DINOv2_Weights.SENTINEL2_ALL_SOFTCON
)
cos = CosineSimilarity()

eie = EarthIndexEmbeddings(root)
s2 = Sentinel2(paths)

sample = s2[xmin:xmax, ymin:ymax]
query = model(sample)

best = None
best_dist = 2**10
for sample in eie:
    dist = cos(query, sample["embedding"])
    if dist < best_dist:
        best_dist = dist
        best = (sample["x"], sample["y"])`;

const torchGeoMappingSnippet = `from torch.utils.data import DataLoader
from torchgeo.datasets import GoogleSatelliteEmbedding, EuroCrops
from torchgeo.samplers import GridGeoSampler

gse = GoogleSatelliteEmbedding(paths)
ec = EuroCrops(paths, download=True)

dataset = gse & ec  # spatiotemporal intersection
sampler = GridGeoSampler(dataset, size=256)
loader = DataLoader(dataset, sampler=sampler)

for batch in loader:
    # k-NN or linear probing on embeddings
    pass`;

export default function EarthEmbeddingProductsPage() {
  // Compute file sizes for the chart
  const fileSizeData = productRows.map((product) => ({
    name: product.name,
    kind: product.kind,
    sizes: aoiScales.map((aoi) => ({
      aoi: aoi.name,
      bytes: computeFileSize(product, aoi.km2),
    })),
  }));

  // Find max for scaling bars
  const maxBytes = Math.max(...fileSizeData.flatMap((p) => p.sizes.map((s) => s.bytes)));

  return (
    <div className="bg-[#040312] text-slate-100">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.2),_transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">
            arXiv 2601.13134 · January 2026
          </p>
          <h1 className="mt-6 text-4xl sm:text-5xl font-serif text-white">
            Earth Embeddings as Products
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200/80">
            Geospatial foundation models promised to democratize Earth observation. What we got
            instead: seven embedding products that cannot load in the same script. This paper maps
            the chaos and ships a practical fix.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <a
              className="rounded-full border border-emerald-300/40 px-4 py-2 text-emerald-200 hover:border-emerald-200 hover:text-white transition"
              href="https://arxiv.org/abs/2601.13134"
              target="_blank"
              rel="noreferrer"
            >
              Read on arXiv
            </a>
            <a
              className="rounded-full border border-white/20 px-4 py-2 text-slate-100 hover:border-white/40 transition"
              href="https://arxiv.org/pdf/2601.13134"
              target="_blank"
              rel="noreferrer"
            >
              PDF
            </a>
            <a
              className="rounded-full border border-white/20 px-4 py-2 text-slate-100 hover:border-white/40 transition"
              href="https://arxiv.org/html/2601.13134v1"
              target="_blank"
              rel="noreferrer"
            >
              HTML
            </a>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-emerald-300/70">
            Heng Fang · Adam J. Stewart · Isaac Corley · Xiao Xiang Zhu · Hossein Azizpour
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-[#fffcf8] text-slate-900">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-16">
          {/* The Problem */}
          <div className="space-y-4">
            <h2 className="text-2xl font-serif">The Problem</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              Earth embeddings are frozen, precomputed representations — the most accessible
              artifact GFMs can produce. No GPU required. Just download and go. Except you
              can&apos;t. They&apos;re scattered across Source Cooperative, Hugging Face, Earth
              Engine, private servers, and one-off GitHub repos. Each with its own format,
              resolution, and coordinate system. The result: an engineering tax that makes fair
              comparison nearly impossible.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Core thesis:</span> The bottleneck is
                not the models. It&apos;s the lack of standardized access to their embedding
                products. We built the hardest part and fumbled the handoff.
              </p>
            </div>
          </div>

          {/* Credit where due */}
          <div className="space-y-4">
            <h2 className="text-2xl font-serif">Credit Where Due</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              Let&apos;s be clear: producing global embedding products is <em>hard</em>. These teams
              processed petabytes of imagery, fought cloud cover, handled projection nightmares, and
              shipped something usable. Clay, Major TOM, Earth Index, Presto, Tessera, Google
              Satellite Embeddings — each represents months of engineering effort. The critique that
              follows is not about the work. It&apos;s about the ecosystem that forces every team to
              reinvent the wheel.
            </p>
          </div>

          {/* Taxonomy */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif">A Taxonomy That Makes the Mess Legible</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              We formalize a three-layer taxonomy: the data assets themselves, the tools that probe
              them, and the downstream value they unlock.
            </p>
            <div className="flex flex-col md:flex-row md:items-stretch gap-4">
              {taxonomyLayers.map((layer, idx) => {
                const Icon = layer.icon;
                return (
                  <div key={layer.title} className="flex items-stretch gap-4">
                    <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-slate-100">
                          <Icon className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            {layer.title}
                          </p>
                          <p className="text-lg font-serif text-slate-900">{layer.subtitle}</p>
                        </div>
                      </div>
                      <ul className="text-sm text-slate-600 space-y-2">
                        {layer.items.map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {idx < taxonomyLayers.length - 1 && (
                      <div className="hidden md:flex items-center">
                        <ArrowRight className="h-5 w-5 text-slate-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Table */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif">The Product Landscape (December 2025)</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              Seven embedding products exist today. Notice the drift: patch vs pixel granularity,
              snapshot vs annual temporal coverage, and a licensing sprawl that makes combination
              legally fraught.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Kind</th>
                    <th className="px-4 py-3 text-left">Spatial</th>
                    <th className="px-4 py-3 text-left">Temporal</th>
                    <th className="px-4 py-3 text-left">Dims</th>
                    <th className="px-4 py-3 text-left">Dtype</th>
                    <th className="px-4 py-3 text-left">License</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.kind}</td>
                      <td className="px-4 py-3 text-slate-600">{row.spatial}</td>
                      <td className="px-4 py-3 text-slate-600">{row.temporal}</td>
                      <td className="px-4 py-3 text-slate-600">{row.dims}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{row.dtype}</td>
                      <td className="px-4 py-3 text-slate-600">{row.license}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* File Size Comparison */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif">The Storage Reality Check</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              Embedding dimension and dtype choices compound fast at scale. Here&apos;s what each
              product costs to store across city, country, and continent AOIs. Pixel products
              dominate storage at scale; patch products stay manageable but sacrifice resolution.
            </p>

            {/* File Size Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Kind</th>
                    {aoiScales.map((aoi) => (
                      <th key={aoi.name} className="px-4 py-3 text-left">
                        {aoi.name}
                        <span className="block text-[10px] font-normal normal-case text-slate-400">
                          {aoi.km2.toLocaleString()} km²
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fileSizeData.map((product) => (
                    <tr key={product.name} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 text-slate-600">{product.kind}</td>
                      {product.sizes.map((size) => (
                        <td key={size.aoi} className="px-4 py-3 text-slate-600 font-mono text-xs">
                          {formatBytes(size.bytes)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Visual Bar Chart */}
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Continent-scale storage (30M km²)
              </p>
              <div className="space-y-3">
                {fileSizeData.map((product) => {
                  const continentSize =
                    product.sizes.find((s) => s.aoi === "Continent")?.bytes ?? 0;
                  const widthPercent = (continentSize / maxBytes) * 100;
                  const isPatch = product.kind === "Patch";
                  return (
                    <div key={product.name} className="flex items-center gap-3">
                      <div className="w-32 text-sm text-slate-700 truncate">{product.name}</div>
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isPatch ? "bg-emerald-400" : "bg-slate-600"
                          }`}
                          style={{ width: `${Math.max(widthPercent, 1)}%` }}
                        />
                      </div>
                      <div className="w-20 text-xs text-slate-500 text-right font-mono">
                        {formatBytes(continentSize)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  Patch embeddings
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-600" />
                  Pixel embeddings
                </span>
              </div>
            </div>
          </div>

          {/* What's Broken */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif">What&apos;s Broken</h2>
            <ul className="space-y-3 text-base text-slate-700">
              {brokenPoints.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The Fix */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif">The Fix: TorchGeo Standardized Access</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              We treat embeddings as first-class geospatial datasets. TorchGeo now ships unified
              loaders and model access so comparison and downstream analysis no longer require
              model-specific engineering. Same API, any product.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Search & retrieval
                </p>
                <CodeBlock code={torchGeoSnippet} language="python" />
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Land-cover mapping
                </p>
                <CodeBlock code={torchGeoMappingSnippet} language="python" />
              </div>
            </div>
          </div>

          {/* Future Principles */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif">Design Principles We Need (Yes, Controversial)</h2>
            <ul className="space-y-3 text-base text-slate-700">
              {futurePrinciples.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Citation */}
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Citation</p>
            <p className="mt-3 text-sm text-slate-700">
              Fang, H., Stewart, A. J., Corley, I., Zhu, X. X., & Azizpour, H. (2026).{" "}
              <span className="font-semibold text-slate-900">
                Earth Embeddings as Products: Taxonomy, Ecosystem, and Standardized Access.
              </span>{" "}
              arXiv:2601.13134.
            </p>
          </div>

          <Footer />
        </div>
      </section>
    </div>
  );
}
