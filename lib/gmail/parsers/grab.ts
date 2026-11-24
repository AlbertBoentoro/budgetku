import type { GmailParser, ParseResult } from "./types";
import { parseIndonesianDate, parseRupiah } from "./money";

const empty: ParseResult = {
  ok: false, amount: null, direction: null, transactionAt: null,
  merchant: null, description: null, confidence: "low",
};

// Require a specific total label: never use the largest price in the receipt.
function total(text: string, label: RegExp): number | null {
  const match = text.match(label);
  return match ? parseRupiah("Rp" + match[1]) : null;
}

function tripRoute(text: string): string | null {
  const section = text.match(/\bYour Trip\b([\s\S]*?)(?:\bPT Grab Teknologi Indonesia\b|\bNPWP\b|$)/i)?.[1];
  if (!section) return null;
  const clean = section.replace(/^[\s\S]*?\b\d+\s*(?:mins?|minutes?|hrs?|hours?)\b/i, "")
    .replace(/[⋮•·|]/g, " ").replace(/\s+/g, " ").trim();
  const time = /\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi;
  const times = [...clean.matchAll(time)];
  if (times.length < 2) return null;
  const pickup = clean.slice(0, times[0].index).trim();
  const destination = clean.slice(times[0].index! + times[0][0].length, times[1].index).trim();
  if (!pickup || !destination || pickup.length > 300 || destination.length > 300) return null;
  return pickup + " ke " + destination;
}

export const grabParser: GmailParser = {
  source: "grab",
  parse({ subject, bodyText }): ParseResult {
    if (subject.trim().toLowerCase() !== "your grab e-receipt") return { ...empty };
    const text = bodyText.replace(/\u00a0/g, " ");
    const rideDate = text.match(/\bPicked up on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/i);
    const isRide = !!rideDate || /\bYour Trip\b/i.test(text);
    const isFood = /\bGrabFood\b|Selamat menikmati makanan Anda/i.test(text);
    if (!isRide && !isFood) return { ...empty };
    let amount: number | null;
    let date: string | null;
    let description: string | null;
    if (isRide) {
      amount = total(text, /\bTotal Paid\s*:?\s*Rp\s*(\d[\d.,]*)/i);
      date = rideDate ? parseIndonesianDate(rideDate[1], "") : null;
      description = tripRoute(text);
    } else {
      // A group receipt contains both the group total and the personal charge.
      const group = /\bGroup Order\b|Semua orang membayar/i.test(text);
      const personal = total(text, /\bKamu membayar\s*:?\s*Rp\s*(\d[\d.,]*)/i);
      amount = personal ?? (group ? null : total(text, /\bTOTAL\s*:?\s*Rp\s*(\d[\d.,]*)/i));
      const foodDate = text.match(/TANGGAL\s*\|\s*WAKTU\s*(\d{1,2}\s+[A-Za-z]+\s+)(\d{2,4})\b/i);
      date = foodDate ? parseIndonesianDate(foodDate[1] + (foodDate[2].length === 2 ? "20" : "") + foodDate[2], "") : null;
      description = text.match(/Pesanan Dari\s*:\s*([^\r\n]+)/i)?.[1]?.trim() || null;
      if (description && description.length > 300) description = null;
    }
    if (amount === null) return { ...empty, merchant: "Grab", description, transactionAt: date };
    return {
      ok: true, amount, direction: "expense", transactionAt: date,
      merchant: "Grab", description,
      confidence: date && description ? "high" : "low",
    };
  },
};
