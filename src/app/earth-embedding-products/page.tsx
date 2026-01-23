import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, Target, Wrench } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { Footer } from "@/components/footer";

const title = "The Technical Debt of Earth Embedding Products";
const description =
  "A deep dive into seven Earth embedding products, why they don't work together, and what we're doing about it.";
const url = "https://isaaccorley.github.io/earth-embedding-products";
const publishedDate = "2026-01-22";

export const metadata: Metadata = {
  title: `${title} | Isaac Corley`,
  description,
  openGraph: {
    title,
    description,
    url,
    type: "article",
    publishedTime: publishedDate,
    authors: ["Isaac Corley"],
    siteName: "Isaac Corley",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@isaaccorley_",
  },
  alternates: {
    canonical: url,
  },
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
    subtitle: "Analysis",
    icon: Wrench,
    items: ["Benchmarks", "Intrinsic dimension", "Open challenges"],
  },
  {
    title: "Value",
    subtitle: "Applications",
    icon: Target,
    items: ["Mapping", "Retrieval", "Time-series"],
  },
];

// Product data with CORRECTED file size metadata
const productRows = [
  {
    name: "Clay",
    kind: "Patch",
    spatial: "5.12 km",
    temporal: "Snapshot",
    dims: 768,
    dtype: "float32",
    bytesPerElement: 4,
    patchKm2: 26.21, // 5.12² km²
    license: "ODC-By-1.0",
  },
  {
    name: "Major TOM",
    kind: "Patch",
    spatial: "~3 km",
    temporal: "Snapshot",
    dims: 2048,
    dtype: "float32",
    bytesPerElement: 4,
    patchKm2: 9.0,
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
    patchKm2: 0.1024, // 0.32² km²
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
    patchKm2: 625, // ~25km × 25km at mid-latitudes
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
    name: "AlphaEarth",
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

const aoiScales = [
  { name: "City", km2: 1_000, example: "SF Bay Area" },
  { name: "Country", km2: 1_000_000, example: "Egypt" },
  { name: "Continent", km2: 30_000_000, example: "Africa" },
];

function computeFileSize(product: (typeof productRows)[0], aoiKm2: number): number {
  if (product.kind === "Patch") {
    const patchKm2 = product.patchKm2 ?? 1;
    const numPatches = aoiKm2 / patchKm2;
    return numPatches * product.dims * product.bytesPerElement;
  } else {
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
  return `${bytes.toFixed(0)} B`;
}

// AWS S3 Standard storage: ~$0.023/GB/month
function formatS3Cost(bytes: number): string {
  const gb = bytes / 1e9;
  const costPerMonth = gb * 0.023;
  if (costPerMonth >= 1000) return `$${(costPerMonth / 1000).toFixed(1)}k/mo`;
  if (costPerMonth >= 1) return `$${costPerMonth.toFixed(0)}/mo`;
  return `$${costPerMonth.toFixed(2)}/mo`;
}

const torchGeoSnippet = `from torchgeo.datasets import EarthIndexEmbeddings, Sentinel2
from torchgeo.models import ViTSmall14_DINOv2_Weights, vit_small_patch14_dinov2
from torch.nn import CosineSimilarity

# Load pretrained foundation model
model = vit_small_patch14_dinov2(
    ViTSmall14_DINOv2_Weights.SENTINEL2_ALL_SOFTCON
)
cos = CosineSimilarity()

# Load embedding product + raw imagery
eie = EarthIndexEmbeddings(root)
s2 = Sentinel2(paths)

# Embed a query region
sample = s2[xmin:xmax, ymin:ymax]
query = model(sample)

# Find most similar location in Earth Index
best, best_dist = None, 2**10
for sample in eie:
    dist = cos(query, sample["embedding"])
    if dist < best_dist:
        best_dist = dist
        best = (sample["x"], sample["y"])`;

const torchGeoMappingSnippet = `from torch.utils.data import DataLoader
from torchgeo.datasets import GoogleSatelliteEmbeddings, EuroCrops
from torchgeo.samplers import GridGeoSampler

gse = GoogleSatelliteEmbeddings(paths)
ec = EuroCrops(paths, download=True)

# Automatic spatiotemporal intersection
dataset = gse & ec
sampler = GridGeoSampler(dataset, size=256)
loader = DataLoader(dataset, sampler=sampler)

for batch in loader:
    # Embeddings ready for k-NN or linear probe
    embeddings = batch["embedding"]
    labels = batch["label"]`;

export default function EarthEmbeddingProductsPage() {
  const fileSizeData = productRows.map((product) => ({
    name: product.name,
    kind: product.kind,
    sizes: aoiScales.map((aoi) => ({
      aoi: aoi.name,
      bytes: computeFileSize(product, aoi.km2),
    })),
  }));

  const maxBytes = Math.max(...fileSizeData.flatMap((p) => p.sizes.map((s) => s.bytes)));

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: title,
            description,
            datePublished: publishedDate,
            author: {
              "@type": "Person",
              name: "Isaac Corley",
              url: "https://isaaccorley.github.io",
              jobTitle: "Senior Machine Learning Engineer",
              worksFor: { "@type": "Organization", name: "Wherobots" },
            },
            publisher: {
              "@type": "Person",
              name: "Isaac Corley",
              url: "https://isaaccorley.github.io",
            },
            mainEntityOfPage: url,
          }),
        }}
      />

      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-10 flex items-center gap-4 px-6 py-4 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-300 transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-slate-300 transition-colors">
          Blog
        </Link>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_60%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-6 py-20 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
            January 2026
          </p>
          <p className="mt-2 text-xs text-slate-500">Isaac Corley</p>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The Technical Debt of Earth Embedding Products
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Geospatial Foundation Models are all impressive feats of research. The problem is what
            happens after the model is trained: distribution, access, and interoperability.
          </p>
        </div>
      </header>

      {/* Article */}
      <article className="mx-auto max-w-2xl px-6 py-16">
        <div className="prose-custom space-y-12">
          {/* Intro */}
          <section className="space-y-4">
            <p className="text-lg leading-relaxed text-slate-300">
              Last month our team spent three days debugging why AlphaEarth embeddings loaded
              upside-down and how to best handle it. The fix required patches to{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://github.com/OSGeo/gdal/issues/13416"
                target="_blank"
                rel="noreferrer"
              >
                GDAL
              </a>
              ,{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://github.com/rasterio/rasterio/issues/3094"
                target="_blank"
                rel="noreferrer"
              >
                Rasterio
              </a>
              , and{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://github.com/torchgeo/torchgeo/pull/3249"
                target="_blank"
                rel="noreferrer"
              >
                TorchGeo
              </a>
              . These aren&apos;t independent: TorchGeo depends on Rasterio depends on GDAL. All
              three need updates, all three need version pins, and now your users can&apos;t run
              older environments. One flipped coordinate killed backwards compatibility across the
              stack.
            </p>
            <p className="leading-relaxed text-slate-400">
              This is the pattern. Every new Earth embedding product ships like a snowflake. If you
              want to compare them or stack them, you become the integrator for half a dozen
              geospatial libraries. Our new{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://arxiv.org/abs/2601.13134"
                target="_blank"
                rel="noreferrer"
              >
                paper
              </a>{" "}
              formalizes this with a taxonomy and TorchGeo integration. This post is about what
              keeps breaking and why the ecosystem still needs some work.
            </p>
          </section>

          {/* The Mess */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Everything ships, nothing plugs in</h2>
            <p className="leading-relaxed text-slate-400">
              Embeddings are scattered across Source Cooperative, Hugging Face, Earth Engine,
              private servers, and one-off GitHub repos. Each has its own tile scheme, CRS
              assumptions, file layout, and storage format. These teams did the hard part:
              petabyte-scale processing, cloud cover filtering, reprojection, model inference, etc.
              The distribution layer is where it falls apart.
            </p>
            <p className="leading-relaxed text-slate-400">
              Here&apos;s what we hit integrating each product into TorchGeo:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://source.coop/clay/clay-model-v0-embeddings"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Clay
                    </a>
                    :
                  </strong>{" "}
                  Non-standard tile naming; had to reverse-engineer the grid layout from file paths.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://huggingface.co/Major-TOM"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Major TOM
                    </a>
                    :
                  </strong>{" "}
                  Parquet with nested geometry columns; required custom deserialization.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://source.coop/earthgenome/earthindexembeddings"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Earth Index
                    </a>
                    :
                  </strong>{" "}
                  Clean GeoParquet. This is what all of them should look like. Also check out the{" "}
                  <a
                    className="text-emerald-400 hover:text-emerald-300"
                    href="https://source.coop/earthgenome/earthindeximagery"
                    target="_blank"
                    rel="noreferrer"
                  >
                    source imagery
                  </a>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://arxiv.org/abs/2503.11849"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Copernicus-Embed
                    </a>
                    :
                  </strong>{" "}
                  0.25° resolution is ~25km at mid-latitudes. Too coarse for most applications.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://arxiv.org/abs/2304.14065"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Presto
                    </a>
                    :
                  </strong>{" "}
                  GeoTIFF but with implicit CRS assumptions that differ from the imagery it was
                  derived from. See the{" "}
                  <a
                    className="text-emerald-400 hover:text-emerald-300"
                    href="https://huggingface.co/datasets/izvonkov/Togo_Presto_Embeddings"
                    target="_blank"
                    rel="noreferrer"
                  >
                    embeddings on Hugging Face
                  </a>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://arxiv.org/abs/2506.20380"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Tessera
                    </a>
                    :
                  </strong>{" "}
                  Hidden behind an{" "}
                  <a
                    className="text-emerald-400 hover:text-emerald-300"
                    href="https://github.com/ucam-eo/geotessera"
                    target="_blank"
                    rel="noreferrer"
                  >
                    API
                  </a>{" "}
                  running on a university server. Returns raw numpy arrays, not geospatial data. No
                  CRS, no bounds, no metadata. You get numbers and a prayer.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    <a
                      className="text-emerald-400 hover:text-emerald-300"
                      href="https://arxiv.org/abs/2507.22291"
                      target="_blank"
                      rel="noreferrer"
                    >
                      AlphaEarth
                    </a>
                    :
                  </strong>{" "}
                  Originally locked inside Earth Engine. Moving 465 TB to{" "}
                  <a
                    className="text-emerald-400 hover:text-emerald-300"
                    href="https://source.coop/tge-labs/aef"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source Cooperative
                  </a>{" "}
                  cost tens of thousands of dollars in egress fees.{" "}
                  <a
                    className="text-emerald-400 hover:text-emerald-300"
                    href="https://tgengine.org/building-frictionless-geospatial-ai-making-alphaearth-foundations-embeddings-accessible/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Taylor Geospatial Engine
                  </a>{" "}
                  and Radiant Earth paid that bill so the rest of us don&apos;t have to.
                </span>
              </li>
            </ul>
            <div className="rounded-xl border border-rose-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-medium text-rose-400">The problem:</p>
              <p className="mt-1 text-sm text-slate-400">
                Every team solves distribution independently. The integration tax compounds across
                products.
              </p>
            </div>
          </section>

          {/* Taxonomy */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Three layers, one tradeoff</h2>
            <p className="leading-relaxed text-slate-400">
              The data layer is where most decisions get made. Patch embeddings are manageable and
              cheap, but they throw away spatial detail. Pixel embeddings are faithful, but they
              blow up storage and bandwidth. Once you see that tradeoff, the rest of the ecosystem
              starts to make sense.
            </p>
            <p className="leading-relaxed text-slate-400">
              The tools layer is where you figure out if embeddings are any good: benchmarks,{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://arxiv.org/abs/2511.02101"
                target="_blank"
                rel="noreferrer"
              >
                intrinsic dimension analysis
              </a>
              , and the open challenges nobody has solved yet. The value layer is what you actually
              do with them: mapping, retrieval, time-series analysis. Most teams jump straight to
              value without building the tools to know if their approach is working.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {taxonomyLayers.map((layer, idx) => {
                const Icon = layer.icon;
                return (
                  <div
                    key={layer.title}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        {layer.title}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-white">{layer.subtitle}</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-500">
                      {layer.items.map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                    {idx < taxonomyLayers.length - 1 && (
                      <ArrowRight className="mt-3 h-4 w-4 text-slate-600 sm:hidden" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Product Table */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">
              What&apos;s actually out there right now
            </h2>
            <p className="leading-relaxed text-slate-400">
              Here&apos;s the full landscape. This is the part that looks clean on paper, but every
              row hides a different file format, spatial grid, and distribution story. Patch vs
              pixel, snapshot vs annual coverage, and licenses that don&apos;t always play nice
              together. You can pick any one of these and make progress. The moment you try to
              compare them, the hidden assumptions start to matter.
            </p>
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-4">Product</th>
                    <th className="pb-3 pr-4">Kind</th>
                    <th className="pb-3 pr-4">Spatial</th>
                    <th className="pb-3 pr-4">Dims</th>
                    <th className="pb-3 pr-4">Dtype</th>
                    <th className="pb-3">License</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  {productRows.map((row) => (
                    <tr key={row.name} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pr-4 font-medium text-white">{row.name}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                            row.kind === "Patch"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {row.kind}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{row.spatial}</td>
                      <td className="py-3 pr-4 font-mono">{row.dims}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{row.dtype}</td>
                      <td className="py-3 text-xs">{row.license}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              If you only care about a city-scale workflow, almost any of these will get you there.
              The moment you care about global coverage or consistent evaluation, the missing
              standards become the bottleneck.
            </p>
          </section>

          {/* Storage Reality */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">
              The part everyone underestimates: storage
            </h2>
            <p className="leading-relaxed text-slate-400">
              The storage math is where enthusiasm dies.{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-slate-300">
                embedding_dim × dtype × spatial_resolution
              </code>{" "}
              compounds fast. A city-scale analysis is fine. Continent-scale? Pixel embeddings
              explode. This is the part that never shows up in model cards.
            </p>
            {/* Patch-only chart */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Patch embeddings: continent-scale storage + cost (Africa, 30M km²)
              </p>
              <div className="mt-4 space-y-2">
                {fileSizeData
                  .filter((p) => p.kind === "Patch")
                  .map((product) => {
                    const continentSize =
                      product.sizes.find((s) => s.aoi === "Continent")?.bytes ?? 0;
                    const maxPatchBytes = Math.max(
                      ...fileSizeData
                        .filter((p) => p.kind === "Patch")
                        .map((p) => p.sizes.find((s) => s.aoi === "Continent")?.bytes ?? 0),
                    );
                    const widthPercent = Math.max((continentSize / maxPatchBytes) * 100, 2);
                    return (
                      <div key={product.name} className="flex items-center gap-3">
                        <div className="w-28 shrink-0 text-sm text-slate-400">{product.name}</div>
                        <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/5">
                          <div
                            className="h-full rounded bg-emerald-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <div className="w-16 shrink-0 text-right font-mono text-xs text-slate-500">
                          {formatBytes(continentSize)}
                        </div>
                        <div className="w-20 shrink-0 text-right font-mono text-xs text-emerald-400/70">
                          {formatS3Cost(continentSize)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            {/* All products chart */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                All embeddings: continent-scale storage + cost (Africa, 30M km²)
              </p>
              <div className="mt-4 space-y-2">
                {fileSizeData.map((product) => {
                  const continentSize =
                    product.sizes.find((s) => s.aoi === "Continent")?.bytes ?? 0;
                  const widthPercent = Math.max((continentSize / maxBytes) * 100, 0.5);
                  const isPatch = product.kind === "Patch";
                  return (
                    <div key={product.name} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-sm text-slate-400">{product.name}</div>
                      <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/5">
                        <div
                          className={`h-full rounded ${
                            isPatch ? "bg-emerald-500" : "bg-slate-500"
                          }`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <div className="w-16 shrink-0 text-right font-mono text-xs text-slate-500">
                        {formatBytes(continentSize)}
                      </div>
                      <div className="w-20 shrink-0 text-right font-mono text-xs text-emerald-400/70">
                        {formatS3Cost(continentSize)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Patch
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  Pixel
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              Presto and Tessera at 10m resolution mean{" "}
              <strong className="text-slate-300">300 billion embeddings</strong> for Africa alone.
              That&apos;s 77 TB for Presto (uint16) and 38 TB for Tessera (int8). Patch products
              like Clay and Copernicus-Embed stay under 4 GB, but you pay for that with spatial
              detail. This is why so many &quot;global&quot; embeddings end up being theoretical
              rather than something you can actually download and use.
            </p>
          </section>

          {/* The Fix */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">
              The only fix that scales: make it boring
            </h2>
            <p className="leading-relaxed text-slate-400">
              After five years of adding datasets to{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://github.com/torchgeo/torchgeo"
                target="_blank"
                rel="noreferrer"
              >
                TorchGeo
              </a>
              , the pattern is obvious: if embeddings are not treated like boring, well-behaved
              geospatial datasets, nobody will use them. TorchGeo now ships unified loaders so you
              can swap products without rewriting your pipeline. Same API, any product. It
              doesn&apos;t solve storage, but it does stop the endless rewrite tax. The goal is not
              magic. The goal is to make embeddings behave like every other dataset you already know
              how to use.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Similarity search
                </p>
                <CodeBlock code={torchGeoSnippet} language="python" small />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Spatial intersection
                </p>
                <CodeBlock code={torchGeoMappingSnippet} language="python" small />
              </div>
            </div>
          </section>

          {/* Hard truths */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Hard truths</h2>
            <ul className="space-y-3 text-slate-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">Stop over-indexing on Sentinel-1/2.</strong> The
                  oceans, atmosphere, and hyperspectral exist. We can&apos;t keep claiming we model
                  the Earth if the majority of Earth is out of scope.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">Cloud-native formats are table stakes.</strong>{" "}
                  GeoParquet, COG, GeoZarr. Pick one and commit. Bespoke formats are a tax on every
                  downstream user and they compound across products.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">Benchmarks must ship with models.</strong> Private
                  benchmarks kill reproducibility. If I can&apos;t run your eval, your numbers
                  don&apos;t exist.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">Embeddings need provenance.</strong> Not just
                  vectors, uncertainty, source imagery hashes, model versions. The metadata matters
                  because the underlying data is a moving target.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">
                    We still don&apos;t have good temporal embeddings.
                  </strong>
                  Most products are snapshots. If you care about change over time, you&apos;re still
                  stitching together your own dataset.
                </span>
              </li>
            </ul>
          </section>

          {/* Call to action */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">What you can do</h2>
            <p className="leading-relaxed text-slate-400">
              If you&apos;re producing embeddings: use GeoParquet for patch embeddings, Zarr for
              pixel embeddings. Include CRS metadata. Document your tile scheme. Create a tile
              index. Make it boring.
            </p>
            <p className="leading-relaxed text-slate-400">
              If you&apos;re consuming embeddings: try the{" "}
              <a
                className="text-emerald-400 hover:text-emerald-300"
                href="https://torchgeo.readthedocs.io/"
                target="_blank"
                rel="noreferrer"
              >
                TorchGeo loaders
              </a>
              . File issues when things break. The only way this gets better is if the pain is
              visible.
            </p>
          </section>

          {/* Citation */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Read the paper
            </p>
            <p className="mt-3 font-mono text-xs leading-relaxed text-slate-400">
              Fang, H., Stewart, A. J., Corley, I., Zhu, X. X., & Azizpour, H. (2026). Earth
              Embeddings as Products: Taxonomy, Ecosystem, and Standardized Access.
              arXiv:2601.13134.
            </p>
            <a
              className="mt-4 inline-block rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20"
              href="https://arxiv.org/abs/2601.13134"
              target="_blank"
              rel="noreferrer"
            >
              View on arXiv
            </a>
          </section>
        </div>

        <Footer />
      </article>
    </div>
  );
}
