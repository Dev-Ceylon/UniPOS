"use client";
import { Button, Card, Input, Select, Table, Td, Th } from "@unipos/ui";
import { Trash2 } from "lucide-react";
import { useAction } from "@/components/use-action";
import { deleteCategory, saveCategory } from "../actions";

type Cat = { id: string; name: string; parentId: string | null; sortOrder: number; color: string | null; count: number };

export function CategoriesEditor({ categories }: { categories: Cat[] }) {
  const { run, pending } = useAction();
  const save = (id: string | null, form: HTMLFormElement) => {
    const fd = new FormData(form);
    run(
      () =>
        saveCategory(id, {
          name: String(fd.get("name")),
          parentId: String(fd.get("parentId") || "") || null,
          sortOrder: Number(fd.get("sortOrder") || 0),
          color: String(fd.get("color") || "") || null,
        }),
      {
        success: "Saved",
        onOk: () => !id && form.reset(),
      },
    );
  };
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Parent</Th>
            <Th>Order</Th>
            <Th>Products</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <Td colSpan={5} className="p-0">
                <form
                  className="grid grid-cols-[1fr_10rem_5rem_4rem_auto] items-center gap-2 px-3 py-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(c.id, e.currentTarget);
                  }}
                >
                  <Input name="name" defaultValue={c.name} aria-label="Category name" required />
                  <Select name="parentId" defaultValue={c.parentId ?? ""} aria-label="Parent category">
                    <option value="">—</option>
                    {categories
                      .filter((x) => x.id !== c.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </Select>
                  <Input name="sortOrder" type="number" defaultValue={c.sortOrder} aria-label="Sort order" />
                  <span className="text-sm text-muted">{c.count}</span>
                  <span className="flex gap-1">
                    <Button type="submit" size="sm" variant="outline" loading={pending}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => confirm(`Delete ${c.name}? Products become uncategorized.`) && run(() => deleteCategory(c.id), { success: "Deleted" })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </form>
              </Td>
            </tr>
          ))}
          <tr>
            <Td colSpan={5} className="p-0">
              <form
                className="grid grid-cols-[1fr_10rem_5rem_auto] items-center gap-2 bg-surface-2 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(null, e.currentTarget);
                }}
              >
                <Input name="name" placeholder="New category" aria-label="New category name" required />
                <Select name="parentId" aria-label="Parent category" defaultValue="">
                  <option value="">No parent</option>
                  {categories.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
                <Input name="sortOrder" type="number" defaultValue={categories.length} aria-label="Sort order" />
                <Button type="submit" size="sm" loading={pending}>
                  Add
                </Button>
              </form>
            </Td>
          </tr>
        </tbody>
      </Table>
    </Card>
  );
}
