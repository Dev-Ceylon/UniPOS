import type { ReceiptModel } from "@unipos/core";
import { Barcode } from "./barcode";

/** 80 mm / 58 mm receipt layout for browser printing (and the on-screen preview). */
export function ReceiptView({ model, width = 80 }: { model: ReceiptModel; width?: 58 | 80 }) {
  return (
    <div className="receipt mx-auto" data-width={width}>
      <div className="text-center">
        <p className="text-base font-bold">{model.title}</p>
        {model.headerLines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <hr className="my-2 border-dashed border-black" />
      {model.meta.map((m) => (
        <div key={m.label} className="flex justify-between gap-2">
          <span>{m.label}</span>
          <span className="text-right">{m.value}</span>
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      {model.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div className="flex justify-between gap-2">
            <span>{it.name}</span>
            <span className="shrink-0">{it.amount}</span>
          </div>
          <div className="pl-2">{it.detail}</div>
          {it.sub.map((s, j) => (
            <div key={j} className="pl-2">
              {s}
            </div>
          ))}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      {model.totals.map((t) => (
        <div key={t.label} className={`flex justify-between ${t.strong ? "text-sm font-bold" : ""}`}>
          <span>{t.label}</span>
          <span>{t.value}</span>
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      {model.payments.map((p, i) => (
        <div key={i} className="flex justify-between">
          <span>{p.label}</span>
          <span>{p.value}</span>
        </div>
      ))}
      {model.footerLines.length ? (
        <div className="mt-2 text-center">
          {model.footerLines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      ) : null}
      {model.barcode ? (
        <div className="mt-2 flex justify-center">
          <Barcode value={model.barcode} height={32} width={1.2} />
        </div>
      ) : null}
    </div>
  );
}
