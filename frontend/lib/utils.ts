import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `€${n.toFixed(2)}`;
}
