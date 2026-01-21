import type { Metadata } from "next";
import { ArrowRight, Database, LineChart, Target, Wrench } from "lucide-react";

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
    accent: "text-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    items: ["Location embeddings", "Patch embeddings", "Pixel embeddings"],
  },
  {
    title: "Tools",
    subtitle: "Analysis frameworks",
    icon: Wrench,
    accent: "text-sky-500",
    bg: "bg-sky-50",
    border: "border-sky-200",
    items: ["Benchmarks", "Intrinsic dimension", "Open challenges"],
  },
  {
    title: "Value",
    subtitle: "Downstream use",
    icon: Target,
    accent: "text-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    items: ["Mapping", "Retrieval", "Time-series analytics"],
  },
];

const productRows = [
  {
    name: "Clay",
    kind: "Patch",
    spatial: "5.12 km",
    temporal: "Snapshot",
    dims: "768",
    license: "ODC-By-1.0",
  },
  {
    name: "Major TOM",
    kind: "Patch",
    spatial: "2.14–3.56 km",
    temporal: "Snapshot",
    dims: "2048",
    license: "CC-BY-SA-4.0",
  },
  {
    name: "Earth Index",
    kind: "Patch",
    spatial: "320 m",
    temporal: "Snapshot",
    dims: "384",
    license: "CC-BY-4.0",
  },
  {
    name: "Copernicus-Embed",
    kind: "Patch",
    spatial: "0.25°",
    temporal: "Annual",
    dims: "768",
    license: "CC-BY-4.0",
  },
  {
    name: "Presto",
    kind: "Pixel",
    spatial: "10 m",
    temporal: "Annual",
    dims: "128",
    license: "CC-BY-4.0",
  },
  {
    name: "Tessera",
    kind: "Pixel",
    spatial: "10 m",
    temporal: "Annual",
    dims: "128",
    license: "CC-BY-4.0",
  },
  {
    name: "Google Satellite",
    kind: "Pixel",
    spatial: "10 m",
    temporal: "Annual",
    dims: "64",
    license: "CC-BY-4.0",
  },
];

const brokenPoints = [
  "Embedding products are scattered across five platforms with incompatible formats.",
  "Metadata is missing or malformed (yes, upside-down rasters actually happened).",
  "Reproducibility is weak: unmaintained repos, no tests, and drifting source data.",
  "Licensing is a maze — impossible to compare products without legal homework.",
];

const futurePrinciples = [
  "Stop over-indexing on Sentinel-1/2. We need oceans, atmosphere, hyperspectral.",
  "Cloud-native formats are non-optional: GeoParquet, COG, GeoZarr — pick one.",
  "Benchmarks must ship with models. Private benchmarks kill progress.",
  "Embeddings need provenance and uncertainty, not just vectors.",
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
  return (
    <div className="bg-[#040312] text-slate-100">
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

      <section className="bg-[#fffcf8] text-slate-900">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-16">
          <div className="space-y-4">
            <h2 className="text-2xl font-serif">The Problem</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              Earth embeddings are the frozen, precomputed alternative to running GFMs on expensive
              GPU stacks. That should make them the most accessible artifact in the pipeline.
              Instead, they are scattered across Source Cooperative, Hugging Face, Earth Engine,
              private servers, and bespoke repos. The result: incompatible formats, mismatched
              resolutions, and an engineering tax that blocks fair comparison and real adoption.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Claim:</span> The bottleneck is not
                the models. It is the lack of standardized access to their embedding products.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <LineChart className="h-5 w-5 text-emerald-600" />
              <h2 className="text-2xl font-serif">A Taxonomy That Makes the Mess Legible</h2>
            </div>
            <p className="text-base text-slate-700 leading-relaxed">
              We formalize a three-layer taxonomy to separate the data assets, the tools that probe
              them, and the value that emerges downstream.
            </p>
            <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
              {taxonomyLayers.map((layer) => {
                const Icon = layer.icon;
                return (
                  <div
                    key={layer.title}
                    className={`rounded-2xl border ${layer.border} ${layer.bg} p-5 flex flex-col gap-4 shadow-sm`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${layer.accent}`} />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                          {layer.title}
                        </p>
                        <p className="text-lg font-serif text-slate-900">{layer.subtitle}</p>
                      </div>
                    </div>
                    <ul className="text-sm text-slate-700 space-y-2">
                      {layer.items.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${layer.accent} bg-current`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {[0, 1].map((index) => (
                <div key={`arrow-${index}`} className="hidden md:flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-slate-400" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-serif">The Product Landscape (December 2025)</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              These are the seven embedding products that exist today. Notice the drift: patch vs
              pixel, snapshot vs annual, and licensing sprawl.
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
                      <td className="px-4 py-3 text-slate-600">{row.license}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-serif">What’s Broken</h2>
            <ul className="space-y-3 text-base text-slate-700">
              {brokenPoints.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-rose-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-serif">The Fix: TorchGeo Standardized Access</h2>
            <p className="text-base text-slate-700 leading-relaxed">
              We treat embeddings as first-class geospatial datasets. TorchGeo now ships unified
              loaders and model access so comparison and downstream analysis no longer require
              model-specific engineering.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {[
                { title: "Search & retrieval", code: torchGeoSnippet },
                { title: "Land-cover mapping", code: torchGeoMappingSnippet },
              ].map((snippet) => (
                <div key={snippet.title} className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    {snippet.title}
                  </p>
                  <pre className="rounded-2xl bg-slate-900 text-slate-100 text-xs leading-relaxed p-4 overflow-x-auto">
                    <code>{snippet.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-serif">Design Principles We Need (Yes, Controversial)</h2>
            <ul className="space-y-3 text-base text-slate-700">
              {futurePrinciples.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

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
        </div>
      </section>
    </div>
  );
}
