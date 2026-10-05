import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { shortenCatalogCode } from "../lib/content/shortCatalogCode";

// Regenerates lib/content/furnitureCatalogData.ts from the furniture workbook:
//   npx tsx scripts/generate-furniture-catalog-data.ts "<path to .xlsx>"
// (or set FURNITURE_XLSX). Reads the English sheet "Product options" and the
// row-aligned Norwegian sheet "Produktvalg (NO)". Throws on anything that
// breaks the assumptions the catalog relies on, instead of writing bad data.

const DEFAULT_XLSX =
  "C:/Users/rkolv/Desktop/Otman/Website/Delivery page/Otman_furniture_product_options_2026_FINAL(2).xlsx";
const OUT_FILE = resolve(__dirname, "../lib/content/furnitureCatalogData.ts");

const HEAVY_PRODUCTS = new Set(["Dining set", "Sofa", "Sofa bed"]);
// "Order-level extras" sheet: XTRALEVERING / XTRAINB — the flat rate for the 2nd+ normal item.
const XTRA_NORMAL = {
  firstStep: { xtraPrice: 154.8, xtraSubcontractorPrice: 103.2 },
  indoor: { xtraPrice: 236.328, xtraSubcontractorPrice: 123.84 },
};

type Row = {
  product: string;
  main: string;
  type: string;
  additional: string;
  price: number | null;
  subPrice: number | null;
  productNo: string;
  typeNo: string;
  additionalNo: string;
};

function text(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("result" in value && value.result != null) return String(value.result);
    if ("text" in value && value.text != null) return String(value.text);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
  }
  return String(value);
}

function num(value: ExcelJS.CellValue): number | null {
  const s = text(value).trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Not a number: "${s}"`);
  return n;
}

function slug(value: string): string {
  return value
    .replace(/['’]/g, "")
    .replace(/Æ/g, "AE").replace(/æ/g, "ae")
    .replace(/Ø/g, "O").replace(/ø/g, "o")
    .replace(/Å/g, "A").replace(/å/g, "a")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function splitManufacturer(label: string) {
  const i = label.lastIndexOf(" — ");
  if (i < 0) throw new Error(`No " — " in assembly type "${label}"`);
  return { type: label.slice(0, i), manufacturer: label.slice(i + 3) };
}

async function main() {
  const path = process.argv[2] ?? process.env.FURNITURE_XLSX ?? DEFAULT_XLSX;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const en = wb.getWorksheet("Product options");
  const no = wb.getWorksheet("Produktvalg (NO)");
  if (!en || !no) throw new Error('Missing sheet "Product options" or "Produktvalg (NO)"');

  const rows: Row[] = [];
  for (let n = 5; n <= en.rowCount; n++) {
    const e = en.getRow(n);
    const o = no.getRow(n);
    if (!text(e.getCell(1).value)) continue;
    if (num(e.getCell(6).value) !== num(o.getCell(6).value)) {
      throw new Error(`EN/NO sheets are not row-aligned at row ${n}`);
    }
    rows.push({
      product: text(e.getCell(1).value).trim(),
      main: text(e.getCell(2).value).trim(),
      type: text(e.getCell(3).value).trim(),
      additional: text(e.getCell(4).value).trim(),
      price: num(e.getCell(6).value),
      subPrice: num(e.getCell(7).value),
      productNo: text(o.getCell(1).value).trim(),
      typeNo: text(o.getCell(3).value).trim(),
      additionalNo: text(o.getCell(4).value).trim(),
    });
  }

  const productNames: string[] = [];
  for (const r of rows) if (!productNames.includes(r.product)) productNames.push(r.product);

  const products = productNames.map((name, index) => {
    const own = rows.filter((r) => r.product === name);
    const nameNo = own[0].productNo;
    const heavy = HEAVY_PRODUCTS.has(name);

    const delivery = (main: string) => {
      const r = own.find((x) => x.main === main && !x.type && !x.additional);
      if (!r || r.price == null || r.subPrice == null) throw new Error(`${name}: no "${main}" price`);
      return { customerPrice: r.price, subcontractorPrice: r.subPrice };
    };
    const firstStep = delivery("Delivery to doorstep");
    const indoor = delivery("Delivery with carry-in");

    // Heavy items pay the full Side-by-Side price for every unit/item.
    const deliveryTypes = {
      firstStep: {
        ...firstStep,
        ...(heavy
          ? { xtraPrice: firstStep.customerPrice, xtraSubcontractorPrice: firstStep.subcontractorPrice }
          : XTRA_NORMAL.firstStep),
      },
      indoor: {
        ...indoor,
        ...(heavy
          ? { xtraPrice: indoor.customerPrice, xtraSubcontractorPrice: indoor.subcontractorPrice }
          : XTRA_NORMAL.indoor),
      },
      installOnlyEnabled: false,
    };

    const options: Record<string, unknown>[] = [];

    // Assembly: type + manufacturer combinations. Option price = "Assembly only"
    // price; "Delivery + assembly" is kept as combinedWithIndoorInstall.
    const assemblyTypes: Row[] = [];
    for (const r of own) {
      if (r.main === "Assembly only" && r.type && r.type !== "Custom / manual quote") assemblyTypes.push(r);
    }
    for (const r of assemblyTypes) {
      const combined = own.find((x) => x.main === "Delivery + assembly" && x.type === r.type);
      if (!combined || combined.price == null || combined.subPrice == null || r.price == null || r.subPrice == null) {
        throw new Error(`${name}: incomplete assembly prices for "${r.type}"`);
      }
      const en2 = splitManufacturer(r.type);
      const no2 = splitManufacturer(r.typeNo);
      options.push({
        code: `ASM_${slug(en2.type)}_${slug(en2.manufacturer)}`,
        category: "install",
        labelEn: r.type,
        labelNo: r.typeNo,
        customerPrice: r.price,
        subcontractorPrice: r.subPrice,
        exclusiveGroup: "type",
        combinedWithIndoorInstall: { customerPrice: combined.price, subcontractorPrice: combined.subPrice },
        typeEn: en2.type,
        typeNo: no2.type,
        manufacturer: en2.manufacturer,
        manufacturerNo: no2.manufacturer,
      });
    }
    deliveryTypes.installOnlyEnabled = assemblyTypes.length > 0;

    // Add-ons come from the doorstep rows (unpacking is free under assembly, so
    // its real price is only there). Verified elsewhere to be identical across
    // the other main options.
    const addOns = own.filter((r) => r.main === "Delivery to doorstep" && r.additional);
    const addOn = (r: Row) => {
      if (r.price == null || r.subPrice == null) throw new Error(`${name}: add-on "${r.additional}" has no price`);
      return { customerPrice: r.price, subcontractorPrice: r.subPrice };
    };
    const unpack = addOns.find((r) => r.additional === "Unpacking and disposal of packaging");
    if (unpack) {
      options.push({ code: "UNPACKING", category: "extra", labelEn: unpack.additional, labelNo: unpack.additionalNo, ...addOn(unpack) });
    }
    for (const r of addOns) {
      const disposal = /^Dismantling for disposal — (.+)$/.exec(r.additional);
      const careful = /^Careful dismantling for reuse — (.+)$/.exec(r.additional);
      if (disposal) {
        options.push({ code: `DISMANTLE_DISPOSAL_${slug(disposal[1])}`, category: "extra", labelEn: r.additional, labelNo: r.additionalNo, ...addOn(r) });
      } else if (careful) {
        options.push({ code: `DISMANTLE_CAREFUL_${slug(careful[1])}`, category: "extra", labelEn: r.additional, labelNo: r.additionalNo, ...addOn(r) });
      }
    }
    const ret = addOns.find((r) => r.additional === "Return old furniture for recycling");
    if (ret) {
      options.push({ code: "RETURN_RECYCLING", category: "return", labelEn: ret.additional, labelNo: ret.additionalNo, ...addOn(ret) });
    }
    const anchor = addOns.find((r) => r.additional === "Wall anchoring / anti-tip securing");
    if (anchor) {
      options.push({ code: "WALL_ANCHORING", category: "extra", labelEn: anchor.additional, labelNo: anchor.additionalNo, ...addOn(anchor) });
    }

    const known = new Set([
      "Unpacking and disposal of packaging",
      "Return old furniture for recycling",
      "Wall anchoring / anti-tip securing",
    ]);
    for (const r of addOns) {
      if (!known.has(r.additional) && !/^(Careful dismantling for reuse|Dismantling for disposal) — /.test(r.additional)) {
        throw new Error(`${name}: unrecognised add-on "${r.additional}"`);
      }
    }

    // Option codes are shortened by the one rule every website catalog uses.
    for (const option of options) option.code = shortenCatalogCode(option.code as string);
    const codes = options.map((o) => o.code as string);
    if (new Set(codes).size !== codes.length) throw new Error(`${name}: duplicate option codes`);

    const manual = own.some((r) => r.type === "Custom / manual quote");
    return {
      code: `FN_${slug(name)}`,
      nameEn: name,
      nameNo,
      sortOrder: index + 1,
      deliveryTypes,
      options,
      ...(manual
        ? { needsImplementation: { labelEn: "Assembly — needs implementation", labelNo: "Montering — trenger implementering" } }
        : {}),
    };
  });

  const lines = products.map((p) => {
    const { options, ...rest } = p;
    const head = JSON.stringify(rest).slice(0, -1);
    return `  ${head},"options":[\n${options.map((o) => `    ${JSON.stringify(o)}`).join(",\n")}\n  ]}`;
  });

  const file = `// GENERATED by scripts/generate-furniture-catalog-data.ts from
// "Otman_furniture_product_options_2026_FINAL(2).xlsx" — do not edit by hand;
// change the workbook (or the generator) and regenerate.
// Prices are NOK ex VAT, exactly as in the source (seeding rounds them to 5 kr).
import type { FurnitureProductSeed } from "@/lib/content/furnitureCatalog";

export const FURNITURE_PRODUCTS_DATA: FurnitureProductSeed[] = [
${lines.join(",\n")}
];
`;
  writeFileSync(OUT_FILE, file, "utf8");
  console.log(`Wrote ${OUT_FILE}: ${products.length} products, ${products.reduce((s, p) => s + p.options.length, 0)} options`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
