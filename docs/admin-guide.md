# Admin and customization guide

## First run

Sign up, then fill in **Set up your business**: name, business type, currency, time zone, language, first location, sales tax and your PIN. Tick *Add demo products* to try it immediately. A new shop can be selling within 15 minutes.

## Business type presets and modules

**Settings → Business → Business type** switches presets (Retail, Grocery, Restaurant, Café, Services). A preset turns modules on/off and sets the register layout (product grid vs tables-first) and receipt defaults. Your data is kept.

Fine-tune features in **Settings → Modules**. Modules with dependencies (e.g. Loyalty needs Customers) switch together.

## Products and stock

- **Products → New product**: name, category, tax class, type (standard, kit, service), variants with SKU/barcode/price/cost, opening stock, modifiers (restaurant), custom fields.
- **Import** a CSV (template on the import page); rows are matched by SKU. **Export CSV** for spreadsheets.
- **Labels** prints barcode labels (A4 3×8 sheet or a label printer). Missing barcodes can be generated (in-store EAN-13, prefix 20).
- **Inventory**: on-hand per location, reorder points, adjustments with reasons, low-stock filter, stock value.
- **Stocktakes**: start, count (scan to add +1), save progress, complete — only the differences are posted.
- **Transfers** (multi-location): draft → send (in transit) → receive (partial receipt returns the rest to the source).
- **Purchasing**: suppliers, purchase orders, receive into stock (updates cost).

## Taxes

**Products → Taxes**. A tax class holds rules with a rate, *inclusive* (already in the price) or exclusive, *compound* (tax on tax), an order, and an optional *region* (matched against the location's tax region). Example for Sri Lanka: class "Standard" with VAT 18% inclusive.

## Staff and roles

**Settings → Staff & roles**: invite by email with a role; the invitee signs up and chooses a PIN. Edit a member to change role, PIN, allowed locations or disable them. Create custom roles by ticking permissions. Built-in roles: Owner (everything), Manager, Cashier, Inventory clerk.

## Receipt, custom fields, theme

- **Receipt**: title, header/footer lines, 80/58 mm, show/hide tax breakdown, cashier, customer, table and barcode — with a live preview. Location address and receipt header (e.g. VAT number) come from **Locations**.
- **Custom fields**: add text/number/yes-no/date/choice fields to products and customers.
- **Theme**: brand colour (contrast is checked) and corner radius.

## Customers and privacy

Customers have purchase history, notes, groups, loyalty points and gift cards. **Export data** downloads everything held about a customer (JSON); **Erase** anonymizes them and detaches their sales. Configure the privacy notice and retention period in **Settings → Business → Personal data**. Customer data is personal data under Sri Lanka's PDPA — confirm obligations with a legal adviser.

## Reports

**Reports**: sales by day/hour, products & profit, categories, staff, tax, tenders and inventory valuation, with date range and location filters. Export CSV or PDF.

## Audit log and backup

- **Settings → Audit log** lists refunds, voids, price changes, discounts flagged, settings and staff changes, PIN lockouts.
- **Settings → Backup**: download a full JSON backup; restore replaces business data (type RESTORE to confirm).
