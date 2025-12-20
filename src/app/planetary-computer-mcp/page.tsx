import type { Metadata } from "next";
import Image from "next/image";
import { McpJsonCard } from "@/components/mcp-json-card";
import { SpinningGlobe } from "@/components/spinning-globe";

const heroStats = [
  { label: "STAC Collections", value: "100+", detail: "Optical, SAR, DEM, Land Cover" },
  { label: "Zero install", value: "npx", detail: "No docker or python dependencies" },
  { label: "Outputs", value: "geotiff, zarr, jpg, png", detail: "Allow agents to see EO data" },
];

const installationCards = [
  {
    label: "VSCode Extension",
    href: "https://marketplace.visualstudio.com/items?itemName=isaaccorley.vscode-planetary-computer-mcp-server",
    icon: (
      <Image
        src="/planetary-computer-mcp/icons/vscode-logo.png"
        alt="VS Code logo"
        width={34}
        height={34}
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
        width={34}
        height={34}
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
      <div className="globe-background" aria-hidden>
        <div className="globe-inner">
          <SpinningGlobe />
          <div className="globe-gradient" />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 space-y-24">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <p className="text-emerald-300 uppercase tracking-[0.35em] text-xs">Planetary computer · mcp server</p>
            <h1 className="text-4xl md:text-5xl text-white font-serif">
              Enabling Agents with Tools to Observe the Earth
            </h1>
            <p className="text-base text-slate-200/80 max-w-2xl">
              Plug Microsoft Planetary Computer’s STAC catalog into VS Code, Cursor, Claude, or any MCP-aware agent.
              Let agents pull EO modalities they need: optical, SAR, DEM, land cover, and render it in RGB to observe and reason about satellite scenes.
            </p>

            <div className="bg-black/25 backdrop-blur border border-emerald-400/40 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-emerald-200/90 font-mono">
                <code className="text-lg text-emerald-200">npx planetary-computer-mcp</code>
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">zero install · no API keys · no docker / python</span>
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
                <p className="text-xs text-slate-300/80">
                  Render MSI, SAR, DEM, LULC, and more to RGB images for agentic analysis.
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
