import assert from 'node:assert/strict';

// Usage: node scripts/verify-live-release.mjs [base-url] [--require-catalog]
// Without --require-catalog an empty store (no product or category URLs in the
// sitemap) passes, and the catalog checks are reported as skipped. Every URL the
// sitemap does list is still checked, so a stale sitemap pointing at removed
// products fails instead of being hidden. Use --require-catalog once real
// products are live (R11.3).
const args=process.argv.slice(2);
const requireCatalog=args.includes('--require-catalog');
const base=new URL(args.find(arg=>!arg.startsWith('--'))??'https://kenasathi.com');
const results=[];
async function check(path,status=200,{privatePage=false,redirect=false}={}) {
  const response=await fetch(new URL(path,base),{redirect:redirect?'manual':'follow',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,status,`${path} HTTP status`);
  if(privatePage) assert.match(response.headers.get('x-robots-tag')??'',/noindex/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const body=await response.text();
  results.push({path,status:response.status});
  return {response,body};
}
await check('/');await check('/products');
const health=await check('/api/health');assert.deepEqual(JSON.parse(health.body),{status:'ok'});
assert.match(health.response.headers.get('cache-control')??'',/no-store/);
for(const path of ['/cart','/checkout','/track-order','/admin/login','/payment/success']) await check(path,200,{privatePage:true});
const guard=await check('/admin',307,{redirect:true});assert.match(guard.response.headers.get('location')??'',/\/admin\/login/);
await check('/products/missing-regression-test-product',404);
const sitemap=await check('/sitemap.xml');
assert.ok(!sitemap.body.includes('/track-order'));
const urls=[...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]));
assert.ok(urls.every(x=>x.origin==='https://kenasathi.com'));
const products=urls.filter(x=>x.pathname.startsWith('/products/'));
const categories=urls.filter(x=>x.pathname.startsWith('/categories/'));
if(requireCatalog) assert.ok(products.length&&categories.length,'Product/category sitemap URLs (--require-catalog)');

// The Product JSON-LD block on a product page (src/lib/seo.ts productStructuredData).
function productJsonLd(body,path) {
  const blocks=[...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
  const product=blocks.flatMap(x=>Array.isArray(x)?x:[x]).find(x=>x['@type']==='Product');
  assert.ok(product,`${path} Product JSON-LD`);
  return product;
}

// The COD buy button is only in the product's own purchase panel (not in the
// in-stock alternatives shown under a coming-soon product).
const BUY_BUTTON='এখনই অর্ডার করুন (COD)';
const COMING_SOON_NOTE='শীঘ্রই আসছে — পণ্য হাতে আসার আগে কোনো অর্ডার বা টাকা নেওয়া হয় না।';
const states={inStock:0,stockEnded:0,comingSoon:0};

// Every listed product must exist and carry Product JSON-LD; a 404 here means the
// sitemap still lists a removed or hidden product. The JSON-LD follows the product's
// state (guideline §৩, seo.ts): in stock → BDT offer, InStock, and the COD button;
// stock ended → BDT offer, OutOfStock, no COD button; coming soon → no offer and no
// price at all, the coming-soon note, and no COD button.
for(const product of products){
  const path=product.pathname;
  const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,`${path} is listed in sitemap.xml but returns ${response.status} (stale sitemap or hidden product)`);
  const body=await response.text();
  const ld=productJsonLd(body,path);
  assert.ok(body.includes(`href="https://kenasathi.com${path}"`),`${path} canonical`);
  if(ld.offers){
    assert.equal(ld.offers.priceCurrency,'BDT',`${path} BDT price`);
    assert.ok(Number(ld.offers.price)>0,`${path} price is a positive number`);
    if(ld.offers.availability==='https://schema.org/InStock'){
      assert.ok(body.includes(BUY_BUTTON),`${path} in stock but has no COD button`);
      states.inStock++;
    } else {
      assert.equal(ld.offers.availability,'https://schema.org/OutOfStock',`${path} offer availability`);
      assert.ok(!body.includes(BUY_BUTTON),`${path} out of stock but still has the COD button`);
      states.stockEnded++;
    }
  } else {
    assert.ok(!('price' in ld)&&!body.includes('"priceCurrency"'),`${path} coming soon must not carry a price`);
    assert.ok(body.includes(COMING_SOON_NOTE),`${path} has no offer but no coming-soon note`);
    assert.ok(!body.includes(BUY_BUTTON),`${path} coming soon but has the COD button`);
    states.comingSoon++;
  }
  results.push({path,status:response.status,state:ld.offers?(ld.offers.availability.endsWith('InStock')?'in_stock':'stock_ended'):'coming_soon'});
}
for(const category of categories) await check(category.pathname);

const catalog={mode:products.length?'products':'empty',products:products.length,...states,categories:categories.length,
  ...(products.length?{}:{skipped:'product detail, JSON-LD and canonical checks (no product URLs in sitemap)'})};
console.log(JSON.stringify({base:base.origin,passed:results.length,catalog,checks:results},null,2));
