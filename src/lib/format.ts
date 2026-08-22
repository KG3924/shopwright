import type { Rank } from "./types";
import { RANKS } from "./types";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Round to the nearest 1/32" so cut lists stay shop-real. */
export function round32(n: number): number {
  return Math.round(n * 32) / 32;
}

export function formatInches(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs + 1e-9);
  const thirtyseconds = Math.round((abs - whole) * 32);
  if (thirtyseconds === 0) return `${sign}${whole}"`;
  if (thirtyseconds === 32) return `${sign}${whole + 1}"`;
  const g = gcd(thirtyseconds, 32);
  const frac = `${thirtyseconds / g}/${32 / g}`;
  return whole === 0 ? `${sign}${frac}"` : `${sign}${whole} ${frac}"`;
}

export function formatDimTriplet(l: number, w: number, t: number): string {
  return `${formatInches(l)} × ${formatInches(w)} × ${formatInches(t)}`;
}

export function parseInches(raw: string): number | null {
  const t = raw.trim().replace(/["″]/g, "").replace(/,/g, "");
  if (!t) return null;
  const mixed = t.match(/^(-?\d+(?:\.\d+)?)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const sign = whole < 0 ? -1 : 1;
    return round32(whole + sign * (Number(mixed[2]) / Number(mixed[3])));
  }
  const frac = t.match(/^(-)?(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    return round32((frac[1] ? -1 : 1) * (Number(frac[2]) / Number(frac[3])));
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return round32(n);
}

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function boardFeet(l: number, w: number, t: number, qty: number): number {
  return (l * w * t * qty) / 144;
}
