import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// "@mlc-ai/web-llm" powers the OPTIONAL in-browser AI mode of the chat. If it has not been installed, point the import at a
// harmless stand-in so the build does not warn on every page. Once you run `npm install @mlc-ai/web-llm` the real package is used.
const hasWebLlm = fs.existsSync(path.join(process.cwd(), "node_modules", "@mlc-ai", "web-llm"));

// Extra image hosts (comma separated) once you move off Unsplash, e.g. "res.cloudinary.com,cdn.yourdomain.com"
const extraHosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.100:3000", "192.168.1.100", "192.168.1.24"],
  poweredByHeader: false,
  turbopack: hasWebLlm ? {} : { resolveAlias: { "@mlc-ai/web-llm": "./src/lib/stubs/webllm-missing.ts" } },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...extraHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
    ],
  },
  async headers() {
    return [
      {
        // Everything except the live demos (below) can never be put inside someone else's page.
        source: "/((?!demo(?:/|$)).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Script rules are left to Next's own handling; these directives close the other doors (plugins, base-tag and form hijacking, framing).
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'" },
        ],
      },
      {
        // Never let a browser or CDN keep API responses (tickets, admin data, studio sites).
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Studio demo sites may be shown inside THIS site's own pages (portfolio preview), and nowhere else.
        source: "/demo/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
