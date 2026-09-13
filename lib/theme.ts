import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const customThemeSchema = z.object({
  name: z.string().min(1).max(40),
  background: hex,
  surface: hex,
  text: hex,
  textMuted: hex,
  accent: hex,
  success: hex,
  danger: hex,
  radius: z.number().min(4).max(20),
});

export type CustomTheme = z.infer<typeof customThemeSchema>;

function luminance(color: string) {
  const values = color.slice(1).match(/.{2}/g)!.map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function contrastRatio(foreground: string, background: string) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export function validateTheme(theme: unknown) {
  const result = customThemeSchema.safeParse(theme);
  if (!result.success) return { valid: false, error: "Das Theme enthält ungültige Werte." };
  if (contrastRatio(result.data.text, result.data.background) < 4.5) {
    return { valid: false, error: "Haupttext benötigt mindestens 4,5:1 Kontrast." };
  }
  if (contrastRatio(result.data.textMuted, result.data.background) < 4.5) {
    return { valid: false, error: "Sekundärtext benötigt mindestens 4,5:1 Kontrast." };
  }
  return { valid: true, data: result.data };
}
