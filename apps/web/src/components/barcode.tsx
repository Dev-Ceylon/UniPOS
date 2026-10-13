"use client";
import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

export function Barcode({
  value,
  format = "CODE128",
  height = 40,
  width = 1.4,
  displayValue = true,
}: {
  value: string;
  format?: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format, height, width, displayValue, margin: 0, fontSize: 12, background: "#ffffff", lineColor: "#000000" });
    } catch {
      JsBarcode(ref.current, value, { format: "CODE128", height, width, displayValue, margin: 0, fontSize: 12 });
    }
  }, [value, format, height, width, displayValue]);
  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} />;
}
