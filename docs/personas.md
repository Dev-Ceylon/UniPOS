# Phase 0 — personas, top tasks and wireframe notes

## Personas

**Nimal — cashier (retail, Colombo).** 24, uses a shared Android tablet and a USB scanner. Needs speed and no surprises when the internet drops.

Top tasks: 1) scan and sell, 2) take cash and give change, 3) split cash/card, 4) apply a manager-approved discount, 5) hold a sale while a customer fetches an item, 6) find a product without a barcode, 7) print/email a receipt, 8) process a simple return, 9) open/close a shift, 10) switch cashier quickly.

**Ashen — owner.** 38, runs one shop and plans a second. Checks numbers on the phone at night.

Top tasks: 1) today's sales and profit, 2) who sold what, 3) low-stock list, 4) change prices, 5) add staff and set permissions, 6) export reports for the accountant, 7) review refunds/voids, 8) set taxes and receipt header, 9) back up data, 10) add a second location.

**Kamala — inventory clerk.** 45, receives deliveries and counts stock monthly.

Top tasks: 1) receive a purchase order, 2) adjust damaged stock, 3) run a stocktake, 4) print labels, 5) import a supplier price list, 6) transfer stock to the branch, 7) set reorder points, 8) find negative stock, 9) create a product with variants, 10) see the stock history of an item.

## Wireframe notes (implemented)

- **Register:** left — search/scan bar, category chips, product grid (favourites first, stock badges); right — cart with per-line qty/discount/price controls, totals with tax breakdown, big Pay button with shortcut hints. Restaurant preset adds a table bar and *Send to kitchen*.
- **Product form:** two columns — details + variants table on the left; modifiers, custom fields and save on the right; stock ledger below.
- **Dashboard:** KPI tiles (sales vs yesterday, transactions, average, profit), sales-by-hour chart, top products, recent sales, low stock, flagged sales.
- **Settings:** left sub-nav (Business, Locations, Staff & roles, Modules, Receipt, Custom fields, Theme, Backup, Audit log).
- **KDS:** ticket cards by age with one large action button (Start → Ready → Bump); late tickets outlined red.

## Still to do with people (cannot be automated)

- Recruit a pilot shop (retail first) and review the register with its owner and two cashiers.
- Run the timed checkout test (target: 3-item cash sale in under 15 s) and the first-run test with a new user.
