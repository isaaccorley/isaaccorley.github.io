import type { Metadata } from "next";
import Image from "next/image";
import { McpJsonCard } from "@/components/mcp-json-card";

const heroStats = [
  { label: "Collections", value: "100+", detail: "Optical, SAR, DEM, Land Cover" },
  { label: "Zero install", value: "npx", detail: "runs where the data lives" },
  { label: "Outputs", value: "GeoTIFF / JPG / PNG", detail: "Allow agents to see EO data" },
];

const installationCards = [
  {
    label: "VSCode Extension",
    href: "https://marketplace.visualstudio.com/items?itemName=isaaccorley.vscode-planetary-computer-mcp-server",
    icon: (
      <Image
        src="/planetary-computer-mcp/icons/vscode-logo.png"
        alt="VS Code logo"
        width={30}
        height={30}
        className="object-contain"
      />
    ),
  },
  {
    label: "npm package",
    href: "https://www.npmjs.com/package/planetary-computer-mcp",
    icon: (
      <Image
        src="/planetary-computer-mcp/icons/npm-logo.png"
        alt="npm logo"
        width={32}
        height={32}
        className="object-contain"
      />
    ),
  },
];

const mcpConfigSnippet = `{
  "mcpServers": {
    "planetary-computer": {
      "command": "npx",
      "args": ["planetary-computer-mcp"]
    }
  }
}`;

const sampleShots = [
  {
    title: "Sentinel-2 L2A",
    location: "Los Angeles · Optical",
    src: "/planetary-computer-mcp/samples/sentinel_2_l2a_medium-la.jpg",
  },
  {
    title: "Sentinel-1 RTC",
    location: "Coastal Miami · SAR",
    src: "/planetary-computer-mcp/samples/sentinel_1_rtc_coastal-miami.jpg",
  },
  {
    title: "NAIP",
    location: "Los Angeles · 0.6m RGBIR",
    src: "/planetary-computer-mcp/samples/naip_medium-la.jpg",
  },
  {
    title: "ESA WorldCover",
    location: "Rural Iowa · Categorical",
    src: "/planetary-computer-mcp/samples/esa_worldcover_rural-iowa.png",
  },
  {
    title: "MTBS Fire",
    location: "Northern California · Burn severity",
    src: "/planetary-computer-mcp/samples/mtbs_fire-ca.png",
  },
  {
    title: "COP DEM",
    location: "Coastal Miami · Elevation",
    src: "/planetary-computer-mcp/samples/cop_dem_glo_30_coastal-miami.jpg",
  },
];

const heroGallery = sampleShots;

export const metadata: Metadata = {
  title: "Planetary Computer MCP",
  description:
    "Zero-install Model Context Protocol server for hacking on the Planetary Computer from any MCP client.",
};

export default function PlanetaryComputerMCPPage() {
  return (
    <div className="relative min-h-screen bg-[#040312] text-slate-100 overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <div className="w-full h-full opacity-80">
          <div
            className="absolute inset-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vmin] h-[120vmin] rounded-full blur-3xl opacity-70 border border-purple-500/20"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(192,132,252,0.25), rgba(79,70,229,0.08) 45%, rgba(8,18,33,0.4) 75%), radial-gradient(circle at 70% 70%, rgba(34,197,94,0.2), rgba(8,18,33,0.1) 65%)",
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vmin] h-[70vmin] rounded-full border border-indigo-200/40 bg-gradient-to-br from-[#0f1c2e] via-[#1a1133] to-[#04020b] shadow-[0_0_120px_rgba(34,197,94,0.2)] animate-[spin_55s_linear_infinite]"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 30%, rgba(216,180,254,0.35), transparent 40%),
                radial-gradient(circle at 70% 70%, rgba(14,165,233,0.25), transparent 50%),
                repeating-conic-gradient(rgba(14,165,233,0.12) 0deg, rgba(14,165,233,0.12) 6deg, transparent 6deg, transparent 18deg)`,
              maskImage:
                "radial-gradient(circle at center, rgba(255,255,255,0.9) 60%, rgba(255,255,255,0.4) 80%, transparent 90%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 10% 20%, rgba(56,189,248,0.2), transparent 40%),
                radial-gradient(circle at 80% 10%, rgba(34,197,94,0.18), transparent 45%),
                radial-gradient(circle at 10% 80%, rgba(99,102,241,0.12), transparent 55%)`,
            }}
          />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 space-y-24">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <p className="text-emerald-300 uppercase tracking-[0.35em] text-xs">Planetary computer · mcp server</p>
            <h1 className="text-4xl md:text-5xl text-white font-serif">
              Enabling Agents with Tools to See Earth Observation Data
            </h1>
            <p className="text-base text-slate-200/80 max-w-2xl">
              Plug Microsoft Planetary Computer’s STAC catalog into VS Code, Cursor, Claude, or any MCP-aware agent.
              Let agents pull EO modalities they need: optical, SAR, DEM, land cover, and render it in RGB to observe and reason about satellite scenes.
            </p>

            <div className="bg-black/25 backdrop-blur border border-emerald-400/40 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-emerald-200/90 font-mono">
                <code className="text-lg text-emerald-200">npx planetary-computer-mcp</code>
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">zero install · no API keys</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="border border-white/10 rounded-lg p-3 bg-white/5">
                    <p className="text-xs uppercase tracking-widest text-emerald-200/80">{stat.label}</p>
                    <p className="text-2xl text-white font-serif">{stat.value}</p>
                    <p className="text-xs text-slate-300/70">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">installation</p>
              <div className="grid gap-3 md:grid-cols-3">
                {installationCards.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-white/10 rounded-2xl p-4 bg-black/20 backdrop-blur hover:border-emerald-400/60 transition flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      {link.icon}
                    </div>
                    <p className="text-[0.65rem] uppercase tracking-[0.35em] text-emerald-300">{link.label}</p>
                  </a>
                ))}

                <McpJsonCard text={mcpConfigSnippet} />
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-b from-cyan-500/20 to-emerald-500/10 blur-3xl" aria-hidden />
            <div className="relative h-full rounded-3xl border border-white/20 bg-black/25 backdrop-blur p-4 flex flex-col gap-4">
              <div className="text-center space-y-1">
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-200">sample scenes</p>
                <h2 className="text-2xl font-serif text-white">What the MCP renders</h2>
                <p className="text-xs text-slate-300/80">
                  Optical, SAR, DEM, land cover, and fire products transformed into RGB for assistants to inspect.
                </p>
              </div>
              <div className="grid gap-3 grid-cols-2">
                {heroGallery.map((shot) => (
                  <div key={shot.title} className="relative rounded-2xl overflow-hidden border border-white/10 aspect-square">
                    <Image
                      src={shot.src}
                      alt={`${shot.title} sample scene`}
                      fill
                      className="object-cover transition duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-[0.65rem] uppercase tracking-widest text-emerald-200">{shot.title}</p>
                      <p className="text-sm text-white font-serif">{shot.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
