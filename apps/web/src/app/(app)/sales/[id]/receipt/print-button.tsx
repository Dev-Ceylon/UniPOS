"use client";
import { Button } from "@unipos/ui";
import { useEffect } from "react";

export function PrintButton() {
  useEffect(() => {
    if (new URLSearchParams(location.search).has("auto")) setTimeout(() => window.print(), 300);
  }, []);
  return (
    <Button className="no-print" onClick={() => window.print()}>
      Print (80 mm)
    </Button>
  );
}
