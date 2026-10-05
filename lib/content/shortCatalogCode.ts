// One rule for every website catalog's option codes: the main words stay
// (ASM, DISMANTLE, RETURN, UNPACKING, product names, brands) and the
// describing words are abbreviated from this one dictionary, so
// "DISMANTLE_CAREFUL_LARGE_7_DRAWERS" becomes "DISMANTLE_CAR_LG_7_DRW".
//
// Applying it twice changes nothing (no abbreviation is itself a key), which
// lets the seeder recognise an option still stored under its old long code:
// shortenCatalogCode(old) === the new code (see seedWebsiteCatalog).
//
// Product codes (WG_…, FN_…) are not shortened — they are the product names,
// and icons are derived from them.

// Multi-word phrases first; matched on whole "_"-separated words.
const ABBREVIATIONS: [string, string][] = [
  ["OTHER_MANUFACTURER", "OTHER"],
  ["A_MOBLER", "AMOBLER"],
  ["AJ_PRODUKTER", "AJ"],
  ["PARTLY_ASSEMBLED", "PARTASM"],
  ["FLAT_PACKED", "FLAT"],
  ["WALL_MOUNTED", "WALLMNT"],
  ["UP_TO", "MAX"],
  ["NON_APPROVED", "NONAPPR"],
  ["FRONT_PANEL", "FP"],
  ["FRONT_EXCLUDED", "NOFP"],
  ["REHANG_DOOR", "REHANG"],
  ["BEFORE", "PRE"],
  ["AFTER", "POST"],
  ["CAREFUL", "CAR"],
  ["DISPOSAL", "DISP"],
  ["LARGE", "LG"],
  ["SMALL", "SM"],
  ["MEDIUM", "MED"],
  ["STANDARD", "STD"],
  ["DRAWERS", "DRW"],
  ["SECTIONS", "SEC"],
  ["SECTION", "SEC"],
  ["MODULAR", "MOD"],
  ["HINGED", "HNG"],
  ["DOORS", "DR"],
  ["DOOR", "DR"],
  ["SLIDING", "SLD"],
  ["CONTINENTAL", "CONT"],
  ["FAMILY", "FAM"],
  ["CHILDRENS", "CHILD"],
  ["DOUBLE", "DBL"],
  ["SINGLE", "SGL"],
  ["EXTENDABLE", "EXT"],
  ["FREESTANDING", "FS"],
  ["INTEGRATED", "INT"],
  ["APPROVED", "APPR"],
  ["WETROOM", "WET"],
  ["WITHOUT", "NO"],
  ["WITH", "W"],
  ["STORAGE", "STOR"],
  ["ADVANCED", "ADV"],
  ["ERGONOMIC", "ERGO"],
  ["OFFICE", "OFC"],
  ["REMOVABLE", "REM"],
  ["COVER", "COV"],
  ["FIXED", "FIX"],
  ["LOUNGE", "LNG"],
  ["FLOATING", "FLT"],
  ["CORNER", "CRN"],
  ["OUTDOOR", "OUT"],
  ["DINING", "DIN"],
  ["INCLUDING", "INCL"],
  ["STACKING", "STACK"],
  ["FITTED", "FIT"],
];

const PHRASES = ABBREVIATIONS.map(([long, short]) => ({ words: long.split("_"), short })).sort(
  (a, b) => b.words.length - a.words.length,
);

export function shortenCatalogCode(code: string): string {
  const words = code.split("_");
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    const phrase = PHRASES.find(({ words: p }) => p.every((word, j) => words[i + j] === word));
    if (phrase) {
      out.push(phrase.short);
      i += phrase.words.length;
    } else {
      out.push(words[i]!);
      i += 1;
    }
  }
  return out.join("_");
}
