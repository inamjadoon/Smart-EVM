/**
 * Centralized EVM math. Use ONLY these helpers — never inline.
 *
 *   SV  = EV - PV
 *   CV  = EV - AC
 *   SPI = EV / PV    (PV = 0 → 1)
 *   CPI = EV / AC    (AC = 0 → 1)
 *   EAC = BAC / CPI
 *   VAC = BAC - EAC
 */
// Unknown inputs give null (shown as "—"), never a made-up 1.00.
type N = number | null | undefined;
export const sv  = (ev: number, pv: N) => (pv == null ? null : ev - pv);
export const cv  = (ev: number, ac: N) => (ac == null ? null : ev - ac);
export const spi = (ev: number, pv: N) => (!pv ? null : ev / pv);
export const cpi = (ev: number, ac: N) => (!ac ? null : ev / ac);
export const eac = (bac: number, cpiV: N) => (!cpiV ? null : bac / cpiV);
export const vac = (bac: number, eacV: N) => (eacV == null ? null : bac - eacV);

export const fmtUsd = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const fmtIdx = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(2);

export const idxTone = (n: number | null | undefined) => {
  if (n == null) return "text-muted-foreground";
  if (n >= 1.0) return "text-success";
  if (n >= 0.85) return "text-warning";
  return "text-destructive";
};
