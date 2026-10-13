import { can, isLowStock } from "@unipos/core";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { money } from "@/lib/format";
import { LinkButton } from "@/components/link-button";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const ctx = await requireContext("products.view");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where = {
    deletedAt: null,
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" as const } }, { barcode: { contains: q } }], deletedAt: null } } },
          ],
        }
      : {}),
  };
  const [products, count, categories] = await read(ctx, (tx) =>
    Promise.all([
      tx.product.findMany({
        where,
        include: {
          category: true,
          taxClass: true,
          variants: { where: { deletedAt: null }, include: { stockLevels: { where: { locationId: ctx.locationId } } } },
        },
        orderBy: { name: "asc" },
        take: 50,
        skip: (page - 1) * 50,
      }),
      tx.product.count({ where }),
      tx.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    ]),
  );
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const edit = can(ctx.member, "products.edit");
  const restaurant = ctx.tenant.modules.includes("restaurant");
  return (
    <div>
      <PageHeader
        title={t("products")}
        description={`${count} products`}
        actions={
          <>
            <LinkButton href="/products/categories">Categories</LinkButton>
            {can(ctx.member, "settings.edit") ? <LinkButton href="/products/taxes">Taxes</LinkButton> : null}
            {restaurant && can(ctx.member, "restaurant.manage") ? <LinkButton href="/products/modifiers">Modifiers</LinkButton> : null}
            {can(ctx.member, "products.import") ? (
              <>
                <LinkButton href="/products/import">Import</LinkButton>
                <LinkButton href="/api/v1/products/export">Export CSV</LinkButton>
              </>
            ) : null}
            <LinkButton href={`/products/labels${q ? `?q=${encodeURIComponent(q)}` : ""}`}>Labels</LinkButton>
            {edit ? (
              <LinkButton href="/products/new" variant="primary">
                New product
              </LinkButton>
            ) : null}
          </>
        }
      />
      <Card className="mb-4 p-3">
        <form className="flex flex-wrap gap-2" role="search">
          <Input name="q" defaultValue={q} placeholder="Name, SKU or barcode" aria-label="Search products" className="max-w-sm" />
          <Select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className="w-48">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit">Search</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>SKU / barcode</Th>
              <Th>Category</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">Stock</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) =>
              p.variants.map((v, i) => {
                const lvl = v.stockLevels[0];
                return (
                  <tr key={v.id}>
                    <Td>
                      {i === 0 ? (
                        <Link href={`/products/${p.id}`} className="font-medium text-primary-ink underline">
                          {p.name}
                        </Link>
                      ) : null}
                      {v.name ? (
                        <span className="text-muted">
                          {" "}
                          {i === 0 ? "— " : "↳ "}
                          {v.name}
                        </span>
                      ) : null}
                      {i === 0 && p.favourite ? (
                        <Badge className="ml-1" tone="primary">
                          ★
                        </Badge>
                      ) : null}
                      {i === 0 && p.type !== "standard" ? <Badge className="ml-1">{p.type}</Badge> : null}
                    </Td>
                    <Td className="text-xs text-muted">
                      {v.sku}
                      {v.barcode ? <div>{v.barcode}</div> : null}
                    </Td>
                    <Td>{i === 0 ? (p.category?.name ?? "—") : ""}</Td>
                    <Td className="tabular text-right">{m(v.price)}</Td>
                    <Td className="tabular text-right">
                      {p.trackStock ? (
                        <span className={(lvl?.onHand ?? 0) < 0 ? "text-danger" : isLowStock(lvl?.onHand ?? 0, lvl?.reorderPoint) ? "text-warning" : ""}>
                          {lvl?.onHand ?? 0}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </Table>
        {!products.length ? (
          <EmptyState
            title="No products found"
            action={
              edit ? (
                <Link className="text-primary-ink underline" href="/products/new">
                  Add a product
                </Link>
              ) : undefined
            }
          >
            Add products one by one or import a CSV.
          </EmptyState>
        ) : null}
        {count > 50 ? (
          <div className="flex justify-between p-3 text-sm">
            {page > 1 ? (
              <Link
                className="text-primary-ink underline"
                href={`/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.category ? { category: sp.category } : {}), page: String(page - 1) })}`}
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Page {page} of {Math.ceil(count / 50)}
            </span>
            {page * 50 < count ? (
              <Link
                className="text-primary-ink underline"
                href={`/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.category ? { category: sp.category } : {}), page: String(page + 1) })}`}
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
