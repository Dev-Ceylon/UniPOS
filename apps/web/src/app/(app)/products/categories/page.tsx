import { PageHeader } from "@unipos/ui";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { CategoriesEditor } from "./editor";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const ctx = await requireContext("products.edit");
  const cats = await read(ctx, (tx) =>
    tx.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    }),
  );
  return (
    <div className="max-w-3xl">
      <PageHeader title="Categories" description="Group products for the register and reports. Order controls the register tabs." />
      <CategoriesEditor
        categories={cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, sortOrder: c.sortOrder, color: c.color, count: c._count.products }))}
      />
    </div>
  );
}
