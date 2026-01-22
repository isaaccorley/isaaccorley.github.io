import type { Metadata } from "next";
import { ArrowRight, Database, Target, Wrench } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Earth Embeddings as Products | Isaac Corley",
  description:
    "A deep dive into seven Earth embedding products, why they don't work together, and what we're doing about it.",
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
from torchgeo.datasets import GoogleSatelliteEmbedding, EuroCrops
from torchgeo.samplers import GridGeoSampler

gse = GoogleSatelliteEmbedding(paths)
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
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_60%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-6 py-20 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
            January 2026 · arXiv:2601.13134
          </p>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Earth Embeddings as Products
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            I co-authored a paper cataloging seven global Earth embedding products. Here&apos;s the
            honest version: what we found, why it&apos;s broken, and what we&apos;re doing about it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20"
              href="https://arxiv.org/abs/2601.13134"
              target="_blank"
              rel="noreferrer"
            >
              Read the Paper
            </a>
            <a
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white"
              href="https://arxiv.org/pdf/2601.13134"
              target="_blank"
              rel="noreferrer"
            >
              PDF
            </a>
          </div>
          <p className="mt-8 text-xs text-slate-500">
            with Heng Fang, Adam J. Stewart, Xiao Xiang Zhu, and Hossein Azizpour
          </p>
        </div>
      </header>

      {/* Article */}
      <article className="mx-auto max-w-2xl px-6 py-16">
        <div className="prose-custom space-y-12">
          {/* Intro */}
          <section className="space-y-4">
            <p className="text-lg leading-relaxed text-slate-300">
              Geospatial foundation models were supposed to democratize Earth observation. Train
              once, use anywhere. The reality?{" "}
              <strong className="text-white">
                Seven embedding products that can&apos;t load in the same script.
              </strong>
            </p>
            <p className="leading-relaxed text-slate-400">
              We spent months cataloging every publicly available Earth embedding product. The paper
              is dense — 12 pages of taxonomy, benchmarks, and TorchGeo integration. This post is
              the distilled version: what actually matters, what&apos;s broken, and what you should
              do about it.
            </p>
          </section>

          {/* The Mess */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">The state of the ecosystem</h2>
            <p className="leading-relaxed text-slate-400">
              Here&apos;s the brutal summary: embeddings are scattered across Source Cooperative,
              Hugging Face, Earth Engine, private servers, and one-off GitHub repos. Each uses
              different formats, coordinate systems, and file layouts.
            </p>
            <p className="leading-relaxed text-slate-400">
              We found <strong className="text-white">upside-down rasters</strong> shipped to
              production. Repos that haven&apos;t been updated in 18 months. Licenses so
              incompatible you&apos;d need a lawyer to combine two products.
            </p>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-sm font-medium text-rose-400">The problem:</p>
              <p className="mt-1 text-sm text-slate-400">
                We built the hard part (petabyte-scale processing) and fumbled the handoff
                (standardized access). Every team reinvents the wheel.
              </p>
            </div>
          </section>

          {/* Credit */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Credit where it&apos;s due</h2>
            <p className="leading-relaxed text-slate-400">
              Before the critique: producing global embeddings is <em>genuinely hard</em>. These
              teams processed petabytes of imagery, fought cloud cover, handled projection
              nightmares, and shipped something usable. Clay, Major TOM, Earth Index, Presto,
              Tessera, Google Satellite Embeddings — each represents months of engineering.
            </p>
            <p className="leading-relaxed text-slate-400">
              The critique isn&apos;t about the work. It&apos;s about the ecosystem that forces
              every team to solve the same distribution problems independently.
            </p>
          </section>

          {/* Taxonomy */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">A taxonomy that makes sense</h2>
            <p className="leading-relaxed text-slate-400">
              We formalized a three-layer framework: the data assets (what you download), the tools
              that probe them (how you evaluate), and the downstream value (why you care).
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
              The seven products (as of December 2025)
            </h2>
            <p className="leading-relaxed text-slate-400">
              Here&apos;s the full landscape. Notice the fragmentation: patch vs pixel granularity,
              snapshot vs annual coverage, and a licensing maze that makes combination legally
              fraught.
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
          </section>

          {/* Storage Reality */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">The storage reality check</h2>
            <p className="leading-relaxed text-slate-400">
              Here&apos;s where it gets interesting. Embedding dimension × dtype × spatial
              resolution compounds fast. A city-scale analysis is fine. Continent-scale? Pixel
              embeddings explode.
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Continent-scale storage (Africa, 30M km²)
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
              like Clay and Copernicus-Embed stay under 4 GB — but sacrifice spatial resolution.
            </p>
          </section>

          {/* The Fix */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-white">The fix: TorchGeo</h2>
            <p className="leading-relaxed text-slate-400">
              We&apos;re treating embeddings as first-class geospatial datasets. TorchGeo now ships
              unified loaders so you can swap products without rewriting your pipeline. Same API,
              any product.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Similarity search in 20 lines
                </p>
                <CodeBlock
                  code={torchGeoSnippet}
                  language="python"
                  filename="similarity_search.py"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Land-cover mapping
                </p>
                <CodeBlock
                  code={torchGeoMappingSnippet}
                  language="python"
                  filename="land_cover.py"
                />
              </div>
            </div>
          </section>

          {/* Hot takes */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">The controversial takes</h2>
            <p className="leading-relaxed text-slate-400">
              After cataloging all of this, here&apos;s what I actually believe:
            </p>
            <ul className="space-y-3 text-slate-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">Stop over-indexing on Sentinel-1/2.</strong> The
                  oceans, atmosphere, and hyperspectral exist. We need embeddings for those too.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  <strong className="text-white">Cloud-native formats are table stakes.</strong>{" "}
                  GeoParquet, COG, GeoZarr — pick one and commit. Bespoke formats are a tax on the
                  entire field.
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
                  vectors — uncertainty, source imagery hashes, model versions. The metadata
                  matters.
                </span>
              </li>
            </ul>
          </section>

          {/* Citation */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Cite the paper
            </p>
            <p className="mt-3 font-mono text-xs leading-relaxed text-slate-400">
              Fang, H., Stewart, A. J., Corley, I., Zhu, X. X., & Azizpour, H. (2026). Earth
              Embeddings as Products: Taxonomy, Ecosystem, and Standardized Access.
              arXiv:2601.13134.
            </p>
          </section>
        </div>

        <Footer />
      </article>
    </div>
  );
}
