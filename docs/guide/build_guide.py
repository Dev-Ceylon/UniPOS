"""Builds docs/guide/UniPOS-Product-Guide.html (rendered to PDF with Chromium)."""
import html

IMG = "img"
sections = []  # (id, title, html)

def fig(name, caption):
    return f'<figure><img src="{IMG}/{name}.png" alt="{html.escape(caption)}"><figcaption>{caption}</figcaption></figure>'

def steps(items):
    out = '<ol class="steps">'
    for it in items:
        out += f"<li>{it}</li>"
    return out + "</ol>"

def tip(text, kind="tip"):
    label = {"tip": "Tip", "note": "Note", "warn": "Important"}[kind]
    return f'<div class="callout {kind}"><strong>{label}.</strong> {text}</div>'

def table(headers, rows, cls=""):
    h = "".join(f"<th>{x}</th>" for x in headers)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'

def section(id_, title, body):
    sections.append((id_, title, body))

# ───────────────────────── 1. Introduction
section("intro", "Introducing UniPOS", f"""
<p class="lead">UniPOS is a modular, offline-first point of sale for small businesses — retail shops, groceries, restaurants, cafés and service businesses. It runs in any modern browser on a PC, tablet or phone, keeps selling when the internet drops, and gives owners live numbers from anywhere.</p>
<p>It was designed for Sri Lankan businesses first — Sri Lankan rupees, VAT that is already included in shelf prices, and English, Sinhala (සිංහල) and Tamil (தமிழ்) — and it works the same way in any country and currency.</p>
<h3>Who it is for</h3>
{table(["Person", "What UniPOS gives them"], [
 ["<b>Cashier</b>", "A fast, scanner-first register with big buttons, keyboard shortcuts and a 4–6 digit PIN to start a shift. It keeps working offline."],
 ["<b>Owner / manager</b>", "Today's sales and profit, low-stock alerts, staff and role control, refunds and voids under permission, and reports exportable to CSV and PDF."],
 ["<b>Inventory clerk</b>", "Stock levels per location, adjustments with reasons, stocktakes with a scanner, transfers between branches and purchase orders."],
 ["<b>Kitchen staff</b>", "A kitchen display that shows orders by table and course, with one big button to start, finish and bump each ticket."],
])}
<h3>Highlights</h3>
<div class="cards">
 <div class="card"><h4>Sell in seconds</h4><p>Scan, tap, pay. A three-item cash sale takes under 15 seconds.</p></div>
 <div class="card"><h4>Never lose a sale</h4><p>Sales are saved on the device first and sync automatically — exactly once.</p></div>
 <div class="card"><h4>Exact money</h4><p>Totals, VAT and refunds are calculated to the cent, the same way on every device.</p></div>
 <div class="card"><h4>One app, many businesses</h4><p>Switch between retail and restaurant modes, or turn single features on and off.</p></div>
 <div class="card"><h4>Safe by design</h4><p>Each business only ever sees its own data. Sensitive actions need permission and are logged.</p></div>
 <div class="card"><h4>Yours to run</h4><p>Open source (MIT). Self-host with Docker or deploy to a cloud host.</p></div>
</div>
{fig("08-register-cart", "The register: product grid on the left, the current sale and totals on the right.")}
""")

# ───────────────────────── 2. Features
section("features", "Feature overview", f"""
<p>UniPOS is built from a small <b>core</b> plus <b>modules</b>. A business type preset switches on the right modules; you can fine-tune them at any time in <i>Settings → Modules</i>.</p>
{table(["Area", "Features"], [
 ["<b>Register</b><br><span class='muted'>always on</span>", "Search by name, SKU or barcode; USB and camera barcode scanning; favourites and category tabs; quantity, line and order discounts; price override (with permission); split tenders — cash, card, wallet, gift card, loyalty points; change due; hold and resume; customer on the sale; keyboard shortcuts; 80 mm / 58 mm receipts to print, PDF or email."],
 ["<b>Offline selling</b>", "Installable app (PWA). Catalogue, prices, taxes and customers are cached on the device. Sales queue in an outbox and sync automatically with retries; nothing is lost or duplicated. Negative stock sold offline is flagged after sync."],
 ["<b>Sales & returns</b>", "Sales history with filters; receipt reprint and PDF; partial refunds linked to the original sale (never more than was sold), restock option, refund to original tenders; void with reason; review of flagged sales."],
 ["<b>Shifts</b>", "Opening float, cash in/out with reasons, takings by tender, cash-up by denomination with expected cash and variance, shift history."],
 ["<b>Catalogue</b>", "Products with variants (size, colour…), SKUs and barcodes (generate in-store EAN-13), categories, units, kits and services, tax classes, favourites, images, custom fields, CSV import/export, barcode label printing."],
 ["<b>Taxes</b>", "Tax classes with inclusive or exclusive rules, compound (tax-on-tax) rules, rule order, and rules limited to a location's tax region."],
 ["<b>Inventory</b>", "Append-only stock ledger, on-hand per location, reorder points and low-stock alerts, adjustments with reasons (damage, correction, receipt), stocktakes with scanning and variance posting, stock valuation."],
 ["<b>Multi-location</b>", "Several stores or warehouses, location switcher, staff restricted to locations, stock transfers with an in-transit state and partial receiving."],
 ["<b>Purchasing</b>", "Suppliers, purchase orders, partial and full receiving into stock, automatic cost update."],
 ["<b>Customers</b>", "Profiles, groups, notes, marketing consent, custom fields, purchase history, lifetime spend, quick-create at the register, personal-data export and erase."],
 ["<b>Loyalty & gift cards</b>", "Points per amount spent, point value and minimum to redeem, manual adjustments; gift cards with scannable codes, balances and expiry, usable as a tender."],
 ["<b>Reports</b>", "Dashboard KPIs vs yesterday, sales by hour/day, products and profit, categories, staff, tax collected, tenders, inventory valuation; date and location filters; CSV and PDF export."],
 ["<b>Restaurant</b>", "Floor-plan editor, table bills shared across devices, guest count, modifier groups (spice level, extras), kitchen notes and courses, send to kitchen, kitchen display with start/ready/bump and recall."],
 ["<b>Quotations & expenses</b>", "Quotes that keep their prices and convert to a sale in one click; expense records by category and month."],
 ["<b>Staff & security</b>", "Email invites, editable roles with fine-grained permissions, cashier PIN switching with lockout, audit log of sensitive actions, full backup and restore."],
 ["<b>Personalisation</b>", "Business-type presets, module toggles, receipt template editor with live preview, custom fields, brand colour, light/dark mode, English/Sinhala/Tamil."],
])}
""")

# ───────────────────────── 3. How it works
section("how", "How UniPOS works", f"""
<p>UniPOS is one web application. Every device — a counter PC, a tablet, the kitchen screen or the owner's phone — opens it in a browser. The register keeps a copy of everything it needs on the device so it can sell without the internet.</p>
<div class="diagram">
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture: devices, offline layer, UniPOS server and database">
 <defs><marker id="a" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5d6066"/></marker></defs>
 <style>.b{{fill:#fff;stroke:#ced0d4;stroke-width:1.5}} .p{{fill:#e8f0fb;stroke:#1464d2;stroke-width:1.5}} .t{{font:600 14px Inter,Arial,sans-serif;fill:#1c1e21}} .s{{font:12px Inter,Arial,sans-serif;fill:#5d6066}} .l{{stroke:#5d6066;stroke-width:1.5;fill:none;marker-end:url(#a)}}</style>
 <rect class="b" x="10" y="20" width="170" height="56" rx="10"/><text class="t" x="24" y="44">Register (tablet/PC)</text><text class="s" x="24" y="63">scanner · printer</text>
 <rect class="b" x="10" y="96" width="170" height="56" rx="10"/><text class="t" x="24" y="120">Back office</text><text class="s" x="24" y="139">owner · manager · clerk</text>
 <rect class="b" x="10" y="172" width="170" height="56" rx="10"/><text class="t" x="24" y="196">Kitchen display</text><text class="s" x="24" y="215">restaurant module</text>
 <rect class="p" x="230" y="12" width="190" height="80" rx="10"/><text class="t" x="244" y="36">Offline layer</text><text class="s" x="244" y="56">catalogue cache (IndexedDB)</text><text class="s" x="244" y="73">sales outbox + auto-sync</text>
 <rect class="p" x="470" y="70" width="140" height="150" rx="10"/><text class="t" x="484" y="96">UniPOS server</text><text class="s" x="484" y="118">sign-in &amp; PINs</text><text class="s" x="484" y="136">permission checks</text><text class="s" x="484" y="154">tax &amp; totals check</text><text class="s" x="484" y="172">sync endpoint</text><text class="s" x="484" y="190">reports &amp; exports</text>
 <rect class="b" x="650" y="100" width="100" height="90" rx="10"/><text class="t" x="664" y="126">Database</text><text class="s" x="664" y="146">PostgreSQL</text><text class="s" x="664" y="164">row-level</text><text class="s" x="664" y="180">security</text>
 <path class="l" d="M180 48 H228"/>
 <path class="l" d="M420 52 C450 52 450 110 468 110"/>
 <path class="l" d="M180 124 H468"/>
 <path class="l" d="M180 200 C320 200 400 190 468 190"/>
 <path class="l" d="M610 145 H648"/>
 <text class="s" x="300" y="250">Each sale is saved on the device first, then pushed to the server.</text>
 <text class="s" x="300" y="268">If the network is down the outbox simply waits and retries.</text>
</svg>
</div>
<h3>The life of a sale</h3>
{steps([
 "The cashier scans items. Prices and taxes come from the catalogue cached on the device, so search is instant (under 100 ms for 10,000 products).",
 "On payment, the register gives the sale its final ID and receipt number, saves it on the device, and prints or shows the receipt immediately — no waiting for the network.",
 "The sale goes into an <b>outbox</b>. When online, it is sent to the server within seconds; when offline, it waits and retries automatically.",
 "The server checks the cashier and permissions, recalculates the totals and tax to confirm them, records the payments, and takes the items out of stock in the stock ledger.",
 "If the same sale arrives twice (for example after a dropped connection), the server recognises it and ignores the copy. Unusual sales — selling below zero stock, unauthorised price changes or big discounts — are flagged for review rather than lost.",
])}
<h3>Principles that keep the numbers right</h3>
{table(["Principle", "What it means for you"], [
 ["Money in whole cents", "Amounts are never rounded wrongly; split discounts and refunds always add up exactly."],
 ["One tax engine everywhere", "VAT-inclusive and exclusive prices, compound and regional taxes give the same result on every device and in every report."],
 ["Append-only stock ledger", "Every stock change is a dated entry with a reason — sale, return, adjustment, receipt, transfer, stocktake. On-hand is always the sum of the history."],
 ["Separated businesses", "Every record belongs to one business, and the database itself blocks one business from reading another's data."],
 ["Permissions and audit log", "Refunds, voids, price overrides, large discounts, settings and staff changes need the right permission and are written to the audit log."],
])}
""")

# ───────────────────────── 4. Getting started
section("start", "Getting started", f"""
<p>Setting up a new business takes a few minutes. You need the address of your UniPOS installation (for example <span class="mono">https://pos.yourshop.lk</span>) — see <a href="#deploy">Installation and hardware</a> if you are installing it yourself.</p>
<h3>Step 1 — Create your account</h3>
{steps(["Open UniPOS in your browser and choose <b>Create account</b>.", "Enter your name, email and a password (at least 8 characters), then press <b>Create account</b>."])}
{fig("01-sign-up", "Creating an account.")}
<h3>Step 2 — Set up your business</h3>
{steps([
 "Enter the <b>business name</b> and choose the <b>business type</b> (Retail shop, Grocery, Restaurant, Café or Services). This switches on the right features.",
 "Choose the <b>currency</b>, <b>time zone</b> and <b>language</b>, and name your first location.",
 "Enter your sales tax — for Sri Lankan VAT: name <i>VAT</i>, rate <i>18</i>, and tick <b>Prices include tax</b>.",
 "Choose your 4–6 digit <b>PIN</b>. You will use it to start selling at the register.",
 "Tick <b>Add demo products</b> if you want sample products to try things out, then press <b>Create business</b>.",
])}
{fig("02-onboarding", "The one-page business setup.")}
<h3>Step 3 — Your dashboard</h3>
<p>UniPOS opens the dashboard. The left menu shows only the features enabled for your business type and allowed for your role. Use the top bar to switch location, switch cashier, change theme or language, see sync status, and sign out.</p>
{fig("03-first-dashboard", "A new business, ready to sell.")}
<h3>Signing in later</h3>
<p>Sign in with your email and password. A shop device can stay signed in all day; cashiers then switch in with their PIN (see <a href="#register">Selling at the register</a>).</p>
{fig("04-sign-in", "Sign-in page.")}
{tip("Install UniPOS as an app: in Chrome or Edge choose <i>Install UniPOS</i> from the address bar (on Android: <i>Add to Home screen</i>). It then opens full-screen and starts even without internet.")}
""")

# ───────────────────────── 5. Register
section("register", "Selling at the register", f"""
<p>The register is designed for speed: the search box is always ready for a scanner, and everything can be done with a mouse, touch or the keyboard.</p>
{fig("06-register-empty", "The register. Favourites first; category tabs along the top; stock left on each tile.")}
<h3>Step 1 — Add products</h3>
{steps([
 "<b>Scan</b> a barcode with a USB scanner — it types into the search box and adds the item automatically.",
 "Or <b>type</b> part of a name or SKU and tap the product. Press <b>Enter</b> to add when there is only one match.",
 "Or tap a <b>favourite</b> or pick a <b>category</b> tab. The camera button scans barcodes with the device camera (Chrome/Edge).",
])}
{fig("07-register-search", "Typing “tea” filters the grid instantly.")}
<h3>Step 2 — Adjust the sale</h3>
{steps([
 "Use <b>−</b> / <b>+</b> or type a quantity. Tap a line to select it; the selected line shows extra buttons.",
 "<b>%</b> gives a line discount, the <b>tag</b> changes the price (managers), and the <b>bin</b> removes the line.",
 "<b>Discount</b> under the totals applies a discount to the whole order. Discounts above your limit (20% by default) need a manager.",
])}
{fig("09-line-discount", "A 10% line discount. Totals and VAT update instantly.")}
<h3>Step 3 — Add a customer (optional)</h3>
<p>Tap <b>Walk-in</b> under <i>Current sale</i> to search customers by name, phone or email, or create a new one. Customers earn loyalty points and appear on the receipt.</p>
{fig("10-customer", "Finding or creating a customer.")}
<h3>Step 4 — Take payment</h3>
{steps([
 "Press <b>Pay</b> (or <b>F4</b>). The amount due is filled in.",
 "Choose a tender. For <b>cash</b>, tap a quick-cash button (exact amount or the next note). For <b>card</b>, take the payment on your card terminal and type the last four digits as the reference.",
 "To <b>split</b> a payment, add several tenders — for example LKR 1,000 by card and the rest in cash. Change is given only from cash.",
 "Gift cards and loyalty points can also be used as tenders.",
 "Press <b>Complete sale</b>.",
])}
{fig("11-payment-split", "A split payment: card and cash, with change due in green.")}
<h3>Step 5 — Receipt and next sale</h3>
<p>The change due is shown in large text with the receipt. Choose <b>Print receipt</b> (80 mm or 58 mm), <b>Email receipt</b>, or press <b>Enter</b> for the next sale.</p>
{fig("12-sale-complete", "Sale complete with the receipt preview.")}
<h3>Keyboard shortcuts</h3>
{table(["Key", "Action"], [["F2 or /", "Search / scan"], ["Enter", "Add scanned code or single match"], ["F4 or Ctrl+Enter", "Pay"], ["F6", "Customer"], ["F7", "Order discount"], ["F8", "Hold sale"], ["F9", "Resume a held sale"], ["+ / −", "Change quantity of the selected line"], ["Delete", "Remove the selected line"], ["Esc", "Clear search / close"]], "compact")}
{fig("13-shortcuts", "Press ? on the register to see the shortcuts.")}
<h3>Hold and resume</h3>
<p>Press <b>F8</b> (or the pause button) to park a sale while a customer fetches something, then serve the next customer. Press <b>F9</b> (or the play button) to bring it back.</p>
<h3>Switching cashier with a PIN</h3>
<p>Tap the name in the top bar and enter your PIN. Sales are then recorded under your name until someone else switches in. After five wrong PINs, that PIN is locked for 15 minutes and the attempt is logged.</p>
{fig("14-pin-switch", "PIN pad for fast cashier switching.")}
<h3>When the internet is down</h3>
<p>A yellow bar says <i>Offline</i>. Keep selling: sales are saved on the device and the counter in the top bar shows how many are waiting. They sync automatically when the connection returns — tap the counter to sync immediately. Creating customers, checking gift-card balances and switching cashier need a connection.</p>
{fig("15-offline", "Selling offline: the sale completes and one sale is waiting to sync.")}
""")

# ───────────────────────── 6. Sales history
section("sales", "Sales history, receipts and returns", f"""
<h3>Finding a sale</h3>
<p>Open <b>Sales</b>. Filter by date range, show only refunds, voided or flagged sales, or search by receipt number or customer. Sales that are still waiting to sync on this device are shown at the top.</p>
{fig("16-sales-list", "Sales history with filters.")}
<h3>Sale details</h3>
<p>The sale page shows items, discounts, taxes, payments, the customer, any refunds, and review flags. From here you can print, download a PDF, email, refund or void.</p>
{fig("17-sale-detail", "A sale with its items, taxes and payments.")}
<h3>Refunding items</h3>
{steps([
 "On the sale page press <b>Refund</b>.",
 "Enter the quantity to refund for each item. UniPOS shows how many are still refundable and never allows refunding more than was sold.",
 "Choose where the money goes (original payment methods, cash, card…) and enter a reason.",
 "Keep <b>Return items to stock</b> ticked if they can be sold again, then press <b>Refund</b>.",
])}
{fig("18-refund", "A partial refund linked to the original sale.")}
<p>The refund is a separate receipt (numbered <span class="mono">RF-…</span>) linked to the original sale, so reports stay correct without special cases. <b>Void</b> cancels a whole sale rung up by mistake and reverses stock; it needs the <i>Void</i> permission and a reason.</p>
<h3>Reprinting a receipt</h3>
<p>Press <b>Print receipt</b> on any sale for the 80 mm layout, or <b>PDF</b> to download it.</p>
{fig("19-receipt-print", "Receipt reprint in the 80 mm layout.")}
""")

# ───────────────────────── 7. Shifts
section("shifts", "Shifts and cash-up", f"""
{steps([
 "At the start of the day open <b>Shifts</b> (or press <b>Open shift</b> on the register) and enter the opening float.",
 "During the day record <b>cash in</b> and <b>cash out</b> (for example, buying milk for the shop) with a reason.",
 "At closing, count the drawer by denomination. UniPOS shows the counted total and the <b>variance</b> against the expected cash as you type.",
 "Press <b>Close shift</b>. The result is saved in the shift history and the audit log.",
])}
{fig("20-shifts", "Shift summary: opening float, cash sales, refunds, cash in/out, expected cash and the denomination count.")}
<p><b>Expected cash</b> = opening float + cash sales − cash refunds + cash in − cash out. The <i>Takings by tender</i> list shows card, wallet and gift-card totals to reconcile against your terminal.</p>
""")

# ───────────────────────── 8. Catalogue
section("catalogue", "Products, taxes and labels", f"""
<h3>The product list</h3>
<p>Open <b>Products</b> to search by name, SKU or barcode and filter by category. Each variant shows its price and stock at the current location.</p>
{fig("21-products", "Product list with stock levels.")}
<h3>Adding a product</h3>
{steps([
 "Press <b>New product</b> and enter the name, category, tax class and type (standard, kit or service).",
 "Fill in the variant row: SKU, barcode, price and cost. Press the <b>wand</b> to generate an in-store barcode if the product has none.",
 "Add more variants (sizes, colours) with <b>+ Variant</b>. Enter opening stock if you track stock.",
 "Tick <b>Show in register favourites</b> for fast sellers, then press <b>Save product</b>.",
])}
{fig("22-product-new", "A new product with a generated barcode, price, cost and opening stock.")}
<h3>Taxes</h3>
<p><b>Products → Taxes</b> manages tax classes. Each class has one or more rules with a rate, <i>Inclusive</i> (already in the price) or exclusive (added at checkout), <i>Compound</i> (tax on tax), an order and an optional region matched against the location's tax region.</p>
{fig("23-taxes", "Tax classes and rules.")}
<h3>Importing and exporting</h3>
<p><b>Import</b> accepts a CSV file (download the template on the page). Rows are matched by SKU and updated, or created; rows with the same name become variants of one product; stock is set through the stock ledger. <b>Export CSV</b> downloads the whole catalogue for spreadsheets.</p>
{fig("24-import", "CSV import with the column list and template.")}
<h3>Printing barcode labels</h3>
<p><b>Labels</b> prints labels with name, price and barcode on A4 label sheets (3 × 8) or a label printer. Filter by name and choose the number of copies.</p>
{fig("25-labels", "Barcode labels ready to print.")}
""")

# ───────────────────────── 9. Inventory
section("inventory", "Inventory, stocktakes and transfers", f"""
<h3>Stock levels</h3>
<p><b>Inventory</b> shows on-hand quantities at the current location, reorder points, value at cost and badges for low or negative stock. Totals at the top show the number of items, units, stock value and low-stock count.</p>
{fig("26-inventory", "Inventory with low-stock and negative-stock badges.")}
<h3>Adjusting stock</h3>
{steps(["Press <b>Adjust</b> on a row.", "Choose <i>Add or remove</i> (e.g. −2) or <i>Set counted quantity</i>.", "Pick a reason — correction, damaged/expired, received without PO, customer return — add a note and save."])}
{fig("27-adjust", "Writing off two damaged items.")}
<p>Every adjustment becomes a dated entry in the product's stock ledger (shown at the bottom of each product page) and in the audit log. Edit a <b>reorder point</b> directly in the table to get low-stock alerts on the dashboard.</p>
<h3>Running a stocktake</h3>
{steps([
 "Open <b>Inventory → Stocktakes</b> and press <b>Start stocktake</b>; choose all products or one category.",
 "Count items: type the counted quantity, or <b>scan</b> each item to add +1.",
 "Press <b>Save progress</b> to continue later, then <b>Complete</b>. Only the differences are posted to stock, so sales made during the count are not lost.",
])}
{fig("28-stocktake", "Counting stock; variances appear in red or orange.")}
<h3>Moving stock between locations</h3>
<p>Add locations in <b>Settings → Locations</b> (each has its own stock, receipt header and tax region).</p>
{fig("29-locations", "Locations: name, code used in receipt numbers, address, receipt header and tax region.")}
{steps([
 "Open <b>Transfers</b> and press <b>New transfer</b>. Choose the destination and scan or search the items to send.",
 "Press <b>Create draft</b>, then <b>Send</b>. Stock leaves the source and is <i>in transit</i>.",
 "At the destination press <b>Receive</b> and confirm the quantities. Anything not received returns to the source.",
])}
{fig("30-transfer", "Creating a transfer to the Kandy branch.")}
""")

# ───────────────────────── 10. Purchasing
section("purchasing", "Suppliers and purchase orders", f"""
{steps([
 "Open <b>Purchasing</b> and add your suppliers (name, contact, phone, email, address).",
 "Press <b>New purchase order</b>, choose the supplier and expected date, and add items with quantity and unit cost.",
 "Press <b>Create draft</b>, then <b>Mark ordered</b> when you send it.",
 "When goods arrive press <b>Receive stock</b> and enter what arrived. Partial deliveries are allowed; the order shows <i>partial</i> until everything is received. Receiving updates each product's cost.",
])}
{fig("31-purchasing", "Purchase orders and suppliers.")}
{fig("32-new-po", "A new purchase order.")}
""")

# ───────────────────────── 11. Customers
section("customers", "Customers, loyalty and gift cards", f"""
<h3>Customers</h3>
<p><b>Customers</b> lists everyone with visits, lifetime spend and points. Create customers here or at the register. Each profile shows purchase history, notes, custom fields, points history and gift cards.</p>
{fig("33-customers", "Customer list.")}
{fig("34-customer-detail", "A customer profile with lifetime spend, visits and purchase history.")}
<h3>Loyalty points</h3>
<p>Turn loyalty on in <b>Settings → Business → Loyalty</b>: set how much a customer spends per point, what one point is worth and the minimum to redeem. Points are earned automatically when a customer is on the sale, reversed on refunds, and can be used as a tender. Managers can adjust points with a reason.</p>
<h3>Gift cards</h3>
<p><b>Gift cards → Issue gift card</b> creates a card with a value, an optional expiry and a scannable code (printable). At the register choose the <i>Gift card</i> tender and scan or type the code; the balance is checked and reduced automatically.</p>
{fig("35-gift-cards", "Issuing a gift card.")}
<h3>Personal data</h3>
<p>On a customer's page, <b>Export data</b> downloads everything held about them and <b>Erase</b> anonymises their profile while keeping sales for your accounts. Record marketing consent on each profile and set a privacy notice and retention period in Settings.</p>
""")

# ───────────────────────── 12. Reports
section("reports", "Dashboard and reports", f"""
<h3>Dashboard</h3>
<p>The dashboard shows today's sales, transactions, average sale and gross profit compared with yesterday, sales by hour, top products, recent sales, low stock and sales that need review.</p>
{fig("05-dashboard", "The owner's dashboard.")}
<h3>Reports</h3>
{steps([
 "Open <b>Reports</b> and choose a date range and location (or all locations).",
 "Pick a report: <b>Sales</b> (by day), <b>Products & profit</b>, <b>Categories</b>, <b>Staff</b>, <b>Tax</b>, <b>Tenders</b> or <b>Inventory</b> valuation.",
 "Press <b>Export CSV</b> for spreadsheets or <b>Export PDF</b> for a printable report for your accountant.",
])}
{fig("36-reports", "Sales report with totals, discounts, tax, refunds and profit.")}
{fig("37-reports-products", "Products and profit report.")}
""")

# ───────────────────────── 13. Quotes & expenses
section("quotes", "Quotations and expenses", f"""
<h3>Quotations</h3>
{steps([
 "Open <b>Quotations → New quotation</b>, choose a customer, add products and adjust prices.",
 "Set <b>Valid until</b> and a note, then press <b>Create</b>. Use <b>Print / PDF</b> to send it.",
 "When the customer accepts, press <b>Convert to sale</b>: the quote opens in the register with its prices, ready to pay.",
])}
{fig("38-quotes", "Creating a quotation.")}
<h3>Expenses</h3>
<p><b>Expenses → Add expense</b> records rent, utilities, salaries and other costs with a category, amount, date and reference. The page totals the month and breaks it down by category.</p>
{fig("39-expenses", "Recording an electricity bill.")}
""")

# ───────────────────────── 14. Restaurant
section("restaurant", "Restaurant and café mode", f"""
<p>Choosing the <b>Restaurant</b> or <b>Café</b> preset switches the register to a tables-first layout, adds modifiers and courses, and turns on the kitchen display.</p>
<h3>Step 1 — Open a table</h3>
<p>Tap a table at the top of the register (or <b>Takeaway</b>). For a new table, choose the number of guests. Tables with an open bill show an orange dot.</p>
{fig("49-table-guests", "Opening table T8 for three guests.")}
<h3>Step 2 — Add dishes with options</h3>
<p>Dishes with modifier groups open an options dialog: choose the spice level and extras, add a kitchen note (“No onions”) and the course.</p>
{fig("50-modifiers", "Choosing options for Chicken Kottu.")}
<h3>Step 3 — Send to the kitchen</h3>
<p>Press <b>Send to kitchen</b>. New items go to the kitchen display, grouped by course; sent items are marked <i>Sent</i> and cannot be reduced below what was sent. The table's bill is saved on the server, so any device can continue it.</p>
{fig("51-restaurant-order", "The order for table T8 with modifiers and notes.")}
<h3>Step 4 — The kitchen display</h3>
<p>Open <b>Kitchen display</b> on a screen in the kitchen. Each ticket shows the table, course, items, options and notes. Press <b>Start</b>, then <b>Ready</b>, then <b>Bump</b>. Tickets older than 15 minutes turn red. <b>Recall</b> brings back the last bumped ticket.</p>
{fig("52-kitchen-display", "A ticket on the kitchen display.")}
<h3>Step 5 — Pay</h3>
<p>Press <b>Pay</b> on the table's bill as for any sale. The table becomes free and the receipt shows the table number.</p>
<h3>Setting up tables and modifiers</h3>
<p><b>Tables & menu</b> is a floor-plan editor: add tables, set seats, area and shape, and drag them to match your room. <b>Products → Modifiers</b> manages modifier groups (for example <i>Spice level</i>: choose one; <i>Extras</i>: up to three, each with an extra price); attach groups to products on the product page.</p>
{fig("53-floor-plan", "Floor-plan editor. Occupied tables are highlighted.")}
{fig("54-modifier-groups", "Modifier groups with extra prices.")}
""")

# ───────────────────────── 15. Settings
section("settings", "Settings and administration", f"""
<h3>Business settings and presets</h3>
<p><b>Settings → Business</b> holds the business name, currency, language, time zone, the discount limit without a manager, stock rules, loyalty settings and the privacy notice. <b>Business type</b> applies a preset — retail, grocery, restaurant, café or services — which switches modules, register layout and receipt defaults without losing data.</p>
{fig("40-settings-business", "Business settings and the business-type preset.")}
<h3>Staff and roles</h3>
{steps([
 "In <b>Settings → Staff & roles</b>, type an email, choose a role and press <b>Send invite</b>. The person receives a link, creates an account and chooses their PIN.",
 "Press <b>Edit</b> on a staff member to change their role, reset their PIN (which also unlocks it), limit them to certain locations or disable them.",
 "Use the built-in roles — Owner, Manager, Cashier, Inventory clerk — or press <b>New role</b> and tick exactly the permissions you want.",
])}
{fig("41-staff", "Staff list, invitations and roles.")}
{fig("42-role-editor", "Creating a custom role with fine-grained permissions.")}
<h3>Modules</h3>
<p><b>Settings → Modules</b> turns features on or off. Modules that depend on others switch together (Loyalty needs Customers; Transfers and Purchasing need Inventory). The menu, register and receipts adapt immediately.</p>
{fig("43-modules", "Turning modules on and off.")}
<h3>Receipt template</h3>
<p>Edit the title, header and footer lines, paper width (80 or 58 mm), and whether to show the tax breakdown, cashier, customer, table and barcode — with a live preview. The location's address and receipt header (for example your VAT number) are added automatically.</p>
{fig("44-receipt-editor", "Receipt editor with live preview.")}
<h3>Custom fields and theme</h3>
<p><b>Custom fields</b> adds your own text, number, yes/no, date or choice fields to products and customers. <b>Theme</b> sets your brand colour (with a contrast check so text stays readable) and corner style. Each person can switch light/dark mode and language from the top bar.</p>
{fig("45-custom-fields", "Custom fields for products and customers.")}
{fig("46-theme", "Brand colour and corner radius.")}
<h3>Backup, restore and audit log</h3>
<p><b>Backup</b> downloads every record for your business as one file; <b>Restore</b> replaces the business data with a backup (type RESTORE to confirm). The <b>Audit log</b> lists refunds, voids, price changes, stock adjustments, settings and staff changes, PIN lock-outs and backups — who did what, and when.</p>
{fig("47-backup", "Backup and restore.")}
{fig("48-audit", "The audit log.")}
""")

# ───────────────────────── 16. Security
section("security", "Security and data protection", f"""
{table(["Area", "How UniPOS protects it"], [
 ["Separation between businesses", "Every record carries its business ID, and the database enforces row-level security, so one business can never read or change another's data — tested automatically, including with deliberately forged queries."],
 ["Sign-in", "Passwords are stored as secure hashes; repeated sign-in attempts are rate-limited. Optional Google sign-in."],
 ["Cashier PINs", "Hashed, rate-limited, locked for 15 minutes after five wrong tries, and every switch is logged."],
 ["Permissions", "Every action on the server checks a permission before touching data; the screen hides what a role cannot do."],
 ["Sensitive actions", "Refunds, voids, price overrides, large discounts, stock adjustments, settings, staff changes and backups are written to the audit log."],
 ["Sales integrity", "The server recalculates every synced sale and rejects tampered totals; unusual sales are flagged for review."],
 ["Personal data", "Consent flag, privacy notice, retention setting, per-customer export and erase (for Sri Lanka's Personal Data Protection Act — confirm obligations with your legal adviser)."],
 ["Web security", "Strict content security policy, no framing, safe CSV export, automated dependency and code scanning."],
])}
""")

# ───────────────────────── 17. Deploy
section("deploy", "Installation and hardware", f"""
<h3>Running UniPOS</h3>
<p>UniPOS needs a server (Node.js) and a PostgreSQL database. The easiest options:</p>
{table(["Option", "Best for", "How"], [
 ["Docker Compose", "Self-hosting on your own PC or server", "Copy <span class='mono'>.env.example</span> to <span class='mono'>.env</span>, set a secret, run <span class='mono'>docker compose up -d</span>, open port 3000."],
 ["Vercel + Neon or Supabase", "Managed cloud, no servers to look after", "Create the database, run the migrations, import the repository in Vercel and set the environment variables."],
 ["Railway or Render", "Simple managed container hosting", "Deploy the Dockerfile with a Postgres add-on and run migrations before each release."],
])}
{tip("Full steps are in <span class='mono'>docs/deployment.md</span> in the source code. GitHub Pages cannot run UniPOS because it only serves static files.", "note")}
<h3>Recommended hardware</h3>
{table(["Device", "Support"], [
 ["Barcode scanner (USB/Bluetooth)", "Works as a keyboard — set it to send Enter after each code."],
 ["Camera scanning", "Chrome, Edge and Android browsers."],
 ["Receipt printer 80 mm / 58 mm", "Through the browser print dialog; set paper width and zero margins. Chrome's kiosk printing prints without the dialog."],
 ["Label printer / A4 label sheets", "Products → Labels."],
 ["Card terminal", "Standalone: take the payment on the terminal and record it as Card with the reference."],
 ["Cash drawer", "Many printers open the drawer on print; direct drawer control comes with the print bridge in v1.1."],
 ["Tablet / PC / kitchen screen", "Any modern browser; install UniPOS as an app for full-screen and offline start."],
])}
""")

# ───────────────────────── Appendix
section("appendix", "Appendix", f"""
<h3>Glossary</h3>
{table(["Term", "Meaning"], [
 ["Tender", "A way of paying: cash, card, wallet, gift card, points or other."],
 ["Split tender", "Paying one sale with more than one tender."],
 ["Inclusive tax", "Tax already included in the shelf price (common for VAT in Sri Lanka)."],
 ["Outbox", "The queue on the device that holds sales until they reach the server."],
 ["Stock ledger", "The history of every stock movement; on-hand is the sum of it."],
 ["Variance", "The difference between what was expected and what was counted (cash or stock)."],
 ["Preset", "A ready-made configuration for a business type."],
 ["Module", "A feature area that can be switched on or off."],
])}
<h3>Roadmap</h3>
{table(["Release", "Focus"], [["v1.1", "Print bridge for ESC/POS printers and cash drawers; scheduled email reports"], ["v1.2", "Services and salon module: appointments and staff calendar"], ["v1.3", "Payment gateway plugins (local gateway first), public API and webhooks"], ["v2.0", "Online store with shared inventory, accounting export, module marketplace"]])}
<h3>Try the demo</h3>
<p>A demo installation seeded with <span class="mono">pnpm --filter @unipos/web seed</span> has a retail shop and a restaurant. Sign in as <span class="mono">owner@demo.unipos.app</span> / <span class="mono">demo1234</span> (PIN 1111) or <span class="mono">cashier@demo.unipos.app</span> / <span class="mono">demo1234</span> (PIN 2222).</p>
{fig("55-dark-mode", "UniPOS in dark mode.")}
""")

# ───────────────────────── Assemble
toc = "".join(f'<li><a href="#{i}"><span class="n">{n}</span>{t}</a></li>' for n, (i, t, _) in enumerate(sections, 1))
body = "".join(f'<section id="{i}" class="chapter"><h2><span class="num">{n}</span>{t}</h2>{b}</section>' for n, (i, t, b) in enumerate(sections, 1))

CSS = open(__file__.replace("build_guide.py", "guide.css")).read()
doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>UniPOS — Product Guide</title><style>{CSS}</style></head><body>
<div class="cover">
 <div class="cover-top"><img src="../../apps/web/public/icon-512.png" alt=""><span>UniPOS</span></div>
 <h1>Product Guide</h1>
 <p class="sub">Features, how it works, and a step-by-step walkthrough</p>
 <img class="cover-shot" src="{IMG}/08-register-cart.png" alt="">
 <div class="cover-foot"><span>Modular, offline-first point of sale</span><span>Version 1.0 · October 2026</span></div>
</div>
<div class="toc"><h2>Contents</h2><ol>{toc}</ol></div>
{body}
</body></html>"""
open(__file__.replace("build_guide.py", "UniPOS-Product-Guide.html"), "w").write(doc)
print("sections", len(sections))
