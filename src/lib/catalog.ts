// Pure client/server catalog and SKU generation utilities for apparel

export function generateColorCode(colorName: string): string {
  const c = colorName.trim();
  const lower = c.toLowerCase();
  if (lower.includes("washed black") || lower === "black") return "BLK";
  if (lower.includes("charcoal")) return "CHA";
  if (lower.includes("bottle") || lower.includes("forest")) return "BGR";
  if (lower.includes("maroon") || lower.includes("burgundy")) return "MAR";
  if (lower.includes("white") || lower.includes("cream")) return "WHT";
  if (lower.includes("navy") || lower.includes("blue")) return "NVY";
  if (lower.includes("olive")) return "OLV";
  if (lower.includes("grey") || lower.includes("gray")) return "GRY";
  if (lower.includes("sand") || lower.includes("beige") || lower.includes("tan")) return "SND";
  if (lower.includes("brown") || lower.includes("mocha") || lower.includes("chocolate")) return "BRN";
  if (lower.includes("red")) return "RED";
  if (lower.includes("purple") || lower.includes("plum")) return "PRP";
  if (lower.includes("yellow") || lower.includes("mustard")) return "YEL";
  if (lower.includes("orange") || lower.includes("rust")) return "RST";
  if (lower.includes("pink") || lower.includes("rose")) return "PNK";
  if (lower.includes("green")) return "GRN";

  const words = c.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const code = words.map((w) => w[0]).join("").toUpperCase();
    return code.length >= 2 ? code.slice(0, 4) : words[0].slice(0, 3).toUpperCase();
  }
  return c.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "VAR";
}

export function generateVariantSku(styleCode: string, color: string, size: string): string {
  const cleanStyle = styleCode.trim().toUpperCase();
  const colorCode = generateColorCode(color);
  const sizeCode = size.trim().toUpperCase().replace(/\s+/g, "");
  return `${cleanStyle}-${colorCode}-${sizeCode}`;
}
