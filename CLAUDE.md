@AGENTS.md

# Website redesign (track progress here)

Before any redesign work — homepage, Kids & Baby page, Home Solutions / problem pages, product page, "শীঘ্রই আসছে", gift wrap, WhatsApp updates, header/footer, categories, or the database changes behind them — read `docs/website-redesign-plan.md` and follow its resume protocol (section ০). Pick up any task marked 🔄 first. When you start, pause or finish a task, update its status and add a line to the log (section ৯) in the same commit as the work.

# Product guidelines (always follow)

Any work that touches products — choosing what to sell, writing or uploading a listing, product pages, categories, stock, prices, discounts, "শীঘ্রই আসছে" / "আগ্রহ জানান", bundles, product images or videos, or the code behind them — must follow these files. Read them before starting such work:

1. `docs/product-guideline-common.md` — rules for every product (Shariah, honesty, stock-zero handling, image rights, site fields, pricing). Always read this first.
2. Then the file for the product's section:
   - Kids & Baby › শিশুদের শিক্ষা → `docs/kids-education-product-guideline.md`
   - সংসারের সমাধান · Home Solutions → `docs/home-solutions-product-guideline.md`

If a request conflicts with these files (for example a fake discount, fake stock, selling before the goods are owned, or labelling never-stocked items "Sold out"), say so and point to the rule instead of doing it. Change a shared rule only in the common file, never by repeating it in a section file.

# Promotion content (Facebook page and website listings)

Promotion material — Facebook posts, captions, reels, the page's cover and details, product sample images, the posting schedule, the interest log and supplier image permissions — lives outside this repo in `D:\KenaSathi\promotion\` on the owner's machine. Before any such work:

1. Read `D:\KenaSathi\promotion\README.md` (its rules in section ১, folder layout in section ২, product list in section ৩) and the product's `products/NN-slug/product.md`.
2. Follow its rules; they summarise the product guidelines above, which win if the two ever differ. Key points: supplier photos only from platforms that gave written permission (`permissions.md`), with "নমুনা ছবি — সরবরাহকারীর ছবি" inside the image; drawn images say "ডিজিটাল নমুনা — আসল পণ্যের ছবি নয়"; no background music in videos; no unproven claims; the coming-soon interest message verbatim; nothing posted or changed on the Facebook page without the owner's explicit OK each time.
3. Save finished files into that folder (a new product gets the next `NN-slug` folder) — never only in a scratchpad — and update the README's product list and log and `schedule.md`.

If the folder is not reachable (another machine or a cloud session), say so and ask the owner instead of guessing its contents.
