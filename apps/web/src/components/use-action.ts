"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Run a server action with pending state, toast feedback and a router refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  function run<T>(fn: () => Promise<Result<T>>, opts: { success?: string; onOk?: (data: T) => void; refresh?: boolean } = {}) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setFieldErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setFieldErrors({});
      if (opts.success) toast.success(opts.success);
      opts.onOk?.(res.data);
      if (opts.refresh !== false) router.refresh();
    });
  }
  return { run, pending, fieldErrors };
}
