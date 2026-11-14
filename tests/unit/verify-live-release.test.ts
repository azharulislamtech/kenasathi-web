import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";

const BUY = "এখনই অর্ডার করুন (COD)";
const COMING_SOON = "শীঘ্রই আসছে — পণ্য হাতে আসার আগে কোনো অর্ডার বা টাকা নেওয়া হয় না।";
const offer = (availability: string) => ({ "@type": "Offer", priceCurrency: "BDT", price: "850.00", availability: `https://schema.org/${availability}` });

// Product page bodies by the last path segment, matching src/lib/seo.ts for each state.
// A slug not listed here is an in-stock product.
const PRODUCT_PAGES: Record<string, { ld: Record<string, unknown>; html: string }> = {
  "coming-soon": { ld: {}, html: COMING_SOON },
  "coming-soon-with-buy": { ld: {}, html: COMING_SOON + BUY },
  "stock-ended": { ld: { offers: offer("OutOfStock") }, html: "" },
  "in-stock-no-buy": { ld: { offers: offer("InStock") }, html: "" }
};

function productBody(path: string) {
  const page = PRODUCT_PAGES[path.split("/").pop() ?? ""] ?? { ld: { offers: offer("InStock") }, html: BUY };
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: "x", ...page.ld });
  return `<link rel="canonical" href="https://kenasathi.com${path}"/><script type="application/ld+json">${ld}</script>${page.html}`;
}

// A fake store that answers the release verifier's requests.
function startStore(sitemapPaths: string[], productStatus = 200): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://local").pathname;
    const send = (status: number, body = "", headers: Record<string, string> = {}) => {
      res.writeHead(status, { "x-content-type-options": "nosniff", ...headers });
      res.end(body);
    };
    if (path === "/api/health") return send(200, JSON.stringify({ status: "ok" }), { "cache-control": "no-store" });
    if (["/cart", "/checkout", "/track-order", "/admin/login", "/payment/success"].includes(path)) {
      return send(200, "ok", { "x-robots-tag": "noindex" });
    }
    if (path === "/admin") return send(307, "", { location: "/admin/login" });
    if (path === "/sitemap.xml") {
      const locs = ["", "/products", ...sitemapPaths].map((p) => `<url><loc>https://kenasathi.com${p}</loc></url>`).join("");
      return send(200, `<urlset>${locs}</urlset>`);
    }
    if (path === "/products/missing-regression-test-product") return send(404);
    if (path.startsWith("/products/")) {
      if (productStatus !== 200) return send(productStatus);
      return send(200, productBody(path));
    }
    return send(200, "ok");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
  }));
}

async function verify(sitemapPaths: string[], flags: string[] = [], productStatus = 200) {
  const { server, url } = await startStore(sitemapPaths, productStatus);
  try {
    // Async spawn keeps this process's event loop free to answer the verifier.
    return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn(process.execPath, ["scripts/verify-live-release.mjs", url, ...flags]);
      let stdout = ""; let stderr = "";
      proc.stdout.on("data", (d: Buffer) => { stdout += d; });
      proc.stderr.on("data", (d: Buffer) => { stderr += d; });
      proc.on("close", (status: number | null) => resolve({ status, stdout, stderr }));
    });
  } finally {
    server.close();
  }
}

test("an empty store passes and reports the skipped catalog checks", async () => {
  const result = await verify([]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.catalog.mode, "empty");
  assert.match(report.catalog.skipped, /no product URLs/);
});

test("--require-catalog fails an empty store", async () => {
  const result = await verify([], ["--require-catalog"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--require-catalog/);
});

test("listed products and categories are checked when present", async () => {
  const result = await verify(["/products/a", "/products/b", "/categories/c"], ["--require-catalog"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.catalog.mode, "products");
  assert.equal(report.catalog.products, 2);
  assert.ok(report.checks.some((c: { path: string }) => c.path === "/products/b"));
});

test("coming-soon and stock-ended products pass without a buy button, and are counted by state", async () => {
  const result = await verify(["/products/a", "/products/coming-soon", "/products/stock-ended"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(
    { inStock: report.catalog.inStock, stockEnded: report.catalog.stockEnded, comingSoon: report.catalog.comingSoon },
    { inStock: 1, stockEnded: 1, comingSoon: 1 }
  );
});

test("a coming-soon product that shows the COD button fails", async () => {
  const result = await verify(["/products/coming-soon-with-buy"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /coming soon but has the COD button/);
});

test("an in-stock product without the COD button fails", async () => {
  const result = await verify(["/products/in-stock-no-buy"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /in stock but has no COD button/);
});

test("a sitemap that lists a removed product fails with a clear message", async () => {
  const result = await verify(["/products/gone"], [], 404);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /listed in sitemap\.xml but returns 404/);
});
