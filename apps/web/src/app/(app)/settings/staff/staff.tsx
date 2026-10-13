"use client";
import { ALL_PERMISSIONS, can, PERMISSIONS } from "@unipos/core";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Dialog, Field, Input, Select, Table, Td, Th } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { cancelInvite, deleteRole, inviteMember, saveRole, updateMember } from "../actions";

type Member = { id: string; name: string; email: string; owner: boolean; roleId: string; active: boolean; hasPin: boolean; locked: boolean; allowedLocationIds: string[] };
type Role = { id: string; name: string; key: string };

export function StaffList({ members, invites, roles, locations }: { members: Member[]; invites: { id: string; email: string; roleId: string }[]; roles: Role[]; locations: { id: string; name: string }[] }) {
  const [edit, setEdit] = useState<Member | null>(null);
  const { run, pending } = useAction();
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const invitable = roles.filter((r) => r.key !== "owner");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff</CardTitle>
      </CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>PIN</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <Td>
                {m.name}
                <span className="block text-xs text-muted">{m.email}</span>
              </Td>
              <Td>{m.owner ? "Owner" : (roleName.get(m.roleId) ?? "—")}</Td>
              <Td>{m.locked ? <Badge tone="danger">Locked</Badge> : m.hasPin ? <Badge tone="success">Set</Badge> : <Badge tone="warning">Not set</Badge>}</Td>
              <Td>{m.active ? <Badge tone="success">Active</Badge> : <Badge>Disabled</Badge>}</Td>
              <Td className="text-right">
                <Button size="sm" variant="outline" onClick={() => setEdit(m)}>
                  Edit
                </Button>
              </Td>
            </tr>
          ))}
          {invites.map((i) => (
            <tr key={i.id}>
              <Td className="text-muted">{i.email}</Td>
              <Td>{roleName.get(i.roleId) ?? "—"}</Td>
              <Td />
              <Td>
                <Badge tone="warning">Invited</Badge>
              </Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => run(() => cancelInvite(i.id), { success: "Invitation cancelled" })}>
                  Cancel
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <CardBody>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            run(() => inviteMember(String(fd.get("email")), String(fd.get("roleId"))), { success: "Invitation sent", onOk: () => form.reset() });
          }}
        >
          <Field label="Invite by email" htmlFor="inv-email">
            <Input id="inv-email" name="email" type="email" required className="w-64" />
          </Field>
          <Field label="Role" htmlFor="inv-role">
            <Select id="inv-role" name="roleId" defaultValue={invitable.find((r) => r.key === "cashier")?.id}>
              {invitable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={pending}>
            Send invite
          </Button>
        </form>
      </CardBody>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""}>
        {edit ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(
                () =>
                  updateMember(edit.id, {
                    roleId: String(fd.get("roleId")),
                    displayName: String(fd.get("displayName")),
                    active: fd.get("active") === "on",
                    allowedLocationIds: fd.getAll("loc").map(String),
                    pin: String(fd.get("pin") ?? ""),
                  }),
                { success: "Saved", onOk: () => setEdit(null) },
              );
            }}
          >
            <Field label="Display name" htmlFor="m-name">
              <Input id="m-name" name="displayName" defaultValue={edit.name} required />
            </Field>
            <Field label="Role" htmlFor="m-role">
              <Select id="m-role" name="roleId" defaultValue={edit.roleId} disabled={edit.owner}>
                {roles.filter((r) => edit.owner || r.key !== "owner").map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              {edit.owner ? <input type="hidden" name="roleId" value={edit.roleId} /> : null}
            </Field>
            <Field label="New PIN (leave empty to keep)" htmlFor="m-pin" hint={edit.locked ? "Setting a new PIN also unlocks the account." : undefined}>
              <Input id="m-pin" name="pin" inputMode="numeric" pattern="\d{4,6}" autoComplete="off" />
            </Field>
            {locations.length > 1 ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-sm font-medium">Allowed locations (none = all)</legend>
                {locations.map((l) => (
                  <Checkbox key={l.id} name="loc" value={l.id} defaultChecked={edit.allowedLocationIds.includes(l.id)} label={l.name} />
                ))}
              </fieldset>
            ) : null}
            <Checkbox name="active" defaultChecked={edit.active} disabled={edit.owner} label="Active (can sign in and use PIN)" />
            {edit.owner ? <input type="hidden" name="active" value="on" /> : null}
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </form>
        ) : null}
      </Dialog>
    </Card>
  );
}

const GROUPS = [...new Set(ALL_PERMISSIONS.map((p) => p.split(".")[0]!))];

export function RolesEditor({ roles }: { roles: { id: string; key: string; name: string; permissions: string[]; system: boolean }[] }) {
  const [edit, setEdit] = useState<{ id: string | null; name: string; permissions: string[]; system: boolean } | null>(null);
  const { run, pending } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setEdit({ id: null, name: "", permissions: [], system: false })}>
          New role
        </Button>
      </CardHeader>
      <ul className="divide-y divide-border">
        {roles.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>
              <span className="font-medium">{r.name}</span> {r.system ? <Badge>built-in</Badge> : null}
              <span className="block text-xs text-muted">{r.permissions.includes("*") ? "All permissions" : `${ALL_PERMISSIONS.filter((p) => can({ permissions: r.permissions }, p)).length} permissions`}</span>
            </span>
            {r.key !== "owner" ? (
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEdit({ id: r.id, name: r.name, permissions: ALL_PERMISSIONS.filter((p) => can({ permissions: r.permissions }, p)), system: r.system })}>
                  Edit
                </Button>
                {!r.system ? (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => confirm(`Delete role ${r.name}?`) && run(() => deleteRole(r.id), { success: "Deleted" })}>
                    Delete
                  </Button>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "New role"} size="lg">
        {edit ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveRole(edit.id, { name: edit.name, permissions: edit.permissions }), { success: "Role saved", onOk: () => setEdit(null) });
            }}
          >
            <Field label="Name" htmlFor="r-name">
              <Input id="r-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {GROUPS.map((g) => (
                <fieldset key={g} className="rounded border border-border p-2">
                  <legend className="px-1 text-sm font-semibold capitalize">{g}</legend>
                  {ALL_PERMISSIONS.filter((p) => p.startsWith(`${g}.`)).map((p) => (
                    <Checkbox
                      key={p}
                      className="flex"
                      label={PERMISSIONS[p]}
                      checked={edit.permissions.includes(p)}
                      onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, p] : edit.permissions.filter((x) => x !== p) })}
                    />
                  ))}
                </fieldset>
              ))}
            </div>
            <Button type="submit" loading={pending}>
              Save role
            </Button>
          </form>
        ) : null}
      </Dialog>
    </Card>
  );
}
