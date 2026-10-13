"use client";
import { Button } from "@unipos/ui";

export function PrintLabels() {
  return <Button onClick={() => window.print()}>Print</Button>;
}
