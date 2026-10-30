// GSM 03.38 basic character set (1 septet each) and extension table (2 each).
// æøå/ÆØÅ are in the basic set, so ordinary Norwegian text stays GSM-7.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€\f";

export type SmsSegmentCount = {
  characters: number;
  segments: number;
  unicode: boolean;
};

// GatewayAPI bills per segment (https://gatewayapi.com/docs/limitations/):
// GSM-7 is 160 chars single / 153 per part, UCS-2 is 70 single / 67 per part.
export function countSmsSegments(text: string): SmsSegmentCount {
  let septets = 0;
  let unicode = false;

  for (const char of text) {
    if (GSM7_BASIC.includes(char)) septets += 1;
    else if (GSM7_EXTENDED.includes(char)) septets += 2;
    else {
      unicode = true;
      break;
    }
  }

  if (!text) return { characters: 0, segments: 0, unicode: false };

  if (unicode) {
    // UCS-2 counts UTF-16 code units, so an emoji is two.
    const units = text.length;
    return { characters: units, segments: units <= 70 ? 1 : Math.ceil(units / 67), unicode: true };
  }

  return { characters: septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153), unicode: false };
}
