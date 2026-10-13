/** EAN-13 helpers for generating in-store barcodes and printing labels. */

export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new RangeError("EAN-13 needs 12 digits before the check digit");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** In-store codes use the GS1 restricted prefix 20–29. */
export function generateEan13(sequence: number, prefix = "20"): string {
  if (!/^2\d$/.test(prefix)) throw new RangeError("In-store prefix must be 20–29");
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= 1e10) throw new RangeError("Sequence out of range");
  const body = prefix + String(sequence).padStart(10, "0");
  return body + ean13CheckDigit(body);
}
