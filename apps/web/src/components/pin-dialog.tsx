"use client";
import { Alert, Button, Dialog } from "@unipos/ui";
import { Delete } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { switchCashier } from "@/lib/shell-actions";

export function PinDialog({ open, onClose, onSwitched }: { open: boolean; onClose: () => void; onSwitched?: (memberId: string, name: string) => void }) {
  const t = useTranslations("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setPin("");
      setError(null);
    }
  }, [open]);

  const submit = (value = pin) =>
    start(async () => {
      const res = await switchCashier(value);
      if (!res.ok) {
        setError(res.error);
        setPin("");
        return;
      }
      toast.success(`${res.name}`);
      onSwitched?.(res.memberId, res.name);
      onClose();
      router.refresh();
    });

  const press = (d: string) => {
    setError(null);
    setPin((p) => (p.length < 6 ? p + d : p));
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col items-center gap-4"
      >
        <label htmlFor="pin-input" className="sr-only">
          PIN
        </label>
        <input
          id="pin-input"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          type="password"
          autoComplete="off"
          className="h-14 w-48 rounded-lg border border-border bg-surface text-center text-3xl tracking-[0.5em]"
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button key={d} variant="secondary" size="xl" className="w-16" onClick={() => press(d)}>
              {d}
            </Button>
          ))}
          <Button variant="ghost" size="xl" className="w-16" aria-label="Backspace" onClick={() => setPin((p) => p.slice(0, -1))}>
            <Delete className="h-5 w-5" />
          </Button>
          <Button variant="secondary" size="xl" className="w-16" onClick={() => press("0")}>
            0
          </Button>
          <Button type="submit" size="xl" className="w-16" loading={pending} disabled={pin.length < 4}>
            OK
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
