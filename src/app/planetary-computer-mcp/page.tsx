import type { Metadata } from "next";
import Link from "next/link";

const integrations = [
  {
    name: "Claude Desktop",
    blurb:
      "Settings → Developer → Add MCP Server. Paste the launch command and Claude watches the logs automatically.",
    href: "https://docs.anthropic.com/en/docs/mcp/getting-started",
    cta: "Claude MCP guide",
  },
  {
    name: "VS Code + Continue",
    blurb:
      "Open Continue, hit the gear, and drop in the server under Tools › Model Context Protocol Servers.",
    href: "https://docs.continue.dev/platform/mcp",
    cta: "Continue docs",
  },
  {
    name: "Cursor IDE",
    blurb:
      "Cursor Settings → MCP Servers. Wire it to the command below and Cursor streams tool calls in real time.",
    href: "https://cursor.sh/blog/mcp",
    cta: "Cursor integration",
  },
  {
    name: "Cline for VS Code",
    blurb:
      "Add a custom MCP endpoint from the Cline sidebar and point it at the Planetary Computer server.",
    href: "https://cline.bot/docs/mcp",
    cta: "Cline instructions",
  },
];

export const metadata: Metadata = {
  title: "Planetary Computer MCP",
  description:
    "Zero-install Model Context Protocol server for hacking on the Planetary Computer from any MCP client.",
};

export default function PlanetaryComputerMCPPage() {
  return (
    <div className="relative min-h-screen bg-[#03040a] text-green-200 font-mono overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <div className="w-full h-full opacity-40">
          <div
            className="absolute inset-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vmin] h-[120vmin] rounded-full blur-3xl opacity-60 border border-purple-500/30"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(192,132,252,0.35), rgba(79,70,229,0.1) 45%, rgba(17,24,39,0.1) 75%), radial-gradient(circle at 70% 70%, rgba(147,51,234,0.3), rgba(17,24,39,0.05) 60%)",
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[65vmin] h-[65vmin] rounded-full border border-purple-200/40 bg-gradient-to-br from-[#1c0f2e] via-[#2b0f45] to-[#04020b] shadow-[0_0_120px_rgba(147,51,234,0.35)]
              animate-[spin_55s_linear_infinite]"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 30%, rgba(216,180,254,0.45), transparent 35%),
                radial-gradient(circle at 70% 70%, rgba(129,140,248,0.35), transparent 50%),
                repeating-conic-gradient(rgba(147,51,234,0.15) 0deg, rgba(147,51,234,0.15) 5deg, transparent 5deg, transparent 15deg)`,
              maskImage:
                "radial-gradient(circle at center, rgba(255,255,255,1) 60%, rgba(255,255,255,0.6) 75%, transparent 85%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 20%, rgba(72,255,168,0.15), transparent 35%),
                radial-gradient(circle at 80% 0%, rgba(59,130,246,0.15), transparent 45%),
                radial-gradient(circle at 10% 80%, rgba(94,234,212,0.12), transparent 50%)`,
            }}
          />
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 space-y-12">
        <header className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-lime-400">mcp.online</p>
          <h1 className="text-4xl md:text-5xl text-lime-200">Planetary Computer MCP</h1>
          <p className="text-base text-green-300/80 max-w-2xl mx-auto">
            Minimal, zero-install MCP server for plugging the Microsoft Planetary Computer into Claude,
            VS Code, Cursor, or anything else that speaks the Model Context Protocol.
          </p>
        </header>

        <section className="bg-black/40 border border-lime-400/40 rounded-xl p-6 shadow-[0_0_40px_rgba(74,222,128,0.15)]">
          <p className="text-xs tracking-widest text-green-400 uppercase">zero install</p>
          <div className="mt-3 bg-black/60 border border-green-400/50 rounded-lg p-4 text-lg text-lime-200 flex items-center justify-between gap-4">
            <code>npx planetary-computer-mcp</code>
            <span className="text-[0.7rem] text-green-400/90">runs in place · pipes logs back to your client</span>
          </div>
          <p className="mt-3 text-sm text-green-200/80">
            No Docker. No extra config. Run the command where the data lives and register it with any MCP client.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="group relative border border-green-400/30 bg-black/40 rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                aria-hidden
                style={{
                  background:
                    "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(74,222,128,0.15))",
                }}
              />
              <div className="relative space-y-4">
                <p className="text-xs text-green-400/80 tracking-widest uppercase">{integration.name}</p>
                <p className="text-sm text-green-100/90 leading-relaxed">{integration.blurb}</p>
                <Link
                  href={integration.href}
                  className="inline-flex items-center text-lime-300 text-sm font-semibold uppercase tracking-wide hover:text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  {integration.cta}
                  <span className="ml-2 text-base" aria-hidden>
                    ↗
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </section>

        <section className="border border-green-400/30 rounded-xl p-6 bg-black/40">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-green-400">what you get</p>
              <ul className="mt-3 space-y-2 text-sm text-green-100/90">
                <li>• Raster + vector assets direct from the Planetary Computer catalog.</li>
                <li>• Query + clip endpoints exposed as MCP tools.</li>
                <li>• Streaming responses your assistant can cite.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-green-400">hacker notes</p>
              <ul className="mt-3 space-y-2 text-sm text-green-100/90">
                <li>• Works anywhere Node runs.</li>
                <li>• Bring your own credentials via env vars.</li>
                <li>• Logs stay local; kill the process to disconnect.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
