import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { installGlobals } from "@remix-run/node";
import tsconfigPaths from "vite-tsconfig-paths";
import { vercelPreset } from "@vercel/remix/vite";

installGlobals({ nativeFetch: true });

// Detect Vercel builds (Vercel sets this automatically). On Vercel we skip
// all the local-dev tunnel/HMR wiring below entirely - it's only relevant
// to `shopify app dev`'s local Cloudflare tunnel and would just add noise
// (or break on URLs Vercel's build env doesn't expect) in a CI build.
const isVercel = Boolean(process.env.VERCEL);

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so it doesn't break the
// Remix dev server. The CLI will eventually stop passing in HOST.
if (
  !isVercel &&
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

let serverConfig = {};

if (!isVercel) {
  const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
    .hostname;

  let hmrConfig;
  if (host === "localhost") {
    hmrConfig = {
      protocol: "ws",
      host: "localhost",
      port: 64999,
      clientPort: 64999,
    };
  } else {
    hmrConfig = {
      protocol: "wss",
      host: host,
      port: parseInt(process.env.FRONTEND_PORT) || 8002,
      clientPort: 443,
    };
  }

  serverConfig = {
    allowedHosts: [host],
    cors: { preflightContinue: true },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: { allow: ["app", "node_modules"] },
  };
}

export default defineConfig({
  server: serverConfig,
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      // Required for Remix to deploy correctly as Vercel Functions instead
      // of being treated as a static site / mis-routed. Without this you
      // typically see either 404s on every route or the function crashing
      // immediately on invocation.
      presets: [vercelPreset()],
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
});
