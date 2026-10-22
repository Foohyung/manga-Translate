import { Chakra_Petch, Inter, Itim, Kanit, Mali, Mitr, Noto_Sans_Thai, Prompt } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
});

// Lettering fonts are only downloaded once a text layer uses them.
const kanit = Kanit({ subsets: ['thai', 'latin'], weight: ['400', '700'], display: 'swap', preload: false });
const prompt = Prompt({ subsets: ['thai', 'latin'], weight: ['400', '700'], display: 'swap', preload: false });
const mitr = Mitr({ subsets: ['thai', 'latin'], weight: ['400', '700'], display: 'swap', preload: false });
const chakraPetch = Chakra_Petch({
  subsets: ['thai', 'latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
});
const itim = Itim({ subsets: ['thai', 'latin'], weight: '400', display: 'swap', preload: false });
const mali = Mali({ subsets: ['thai', 'latin'], weight: ['400', '700'], display: 'swap', preload: false });

/** CSS variables of the interface fonts, applied to <html>. */
export const uiFontVariables = `${inter.variable} ${notoSansThai.variable}`;

export const LETTERING_FONTS = [
  { id: 'noto-sans-thai', label: 'Noto Sans Thai — มาตรฐาน', family: notoSansThai.style.fontFamily },
  { id: 'kanit', label: 'Kanit — ทันสมัย', family: kanit.style.fontFamily },
  { id: 'prompt', label: 'Prompt — เรียบหรู', family: prompt.style.fontFamily },
  { id: 'mitr', label: 'Mitr — อ่านง่าย', family: mitr.style.fontFamily },
  { id: 'chakra-petch', label: 'Chakra Petch — แอคชั่น', family: chakraPetch.style.fontFamily },
  { id: 'itim', label: 'Itim — ลายมือ', family: itim.style.fontFamily },
  { id: 'mali', label: 'Mali — น่ารัก', family: mali.style.fontFamily },
] as const;

export type FontId = (typeof LETTERING_FONTS)[number]['id'];

export const DEFAULT_FONT_ID: FontId = 'noto-sans-thai';

export function fontFamily(id: FontId): string {
  return (LETTERING_FONTS.find((font) => font.id === id) ?? LETTERING_FONTS[0]).family;
}
