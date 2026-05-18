import "dotenv/config";
import { prisma } from "../lib/db";
import {
  runWordpressAttachmentImport,
  runWordpressOrderImport,
  verifyWordpressOrderImport,
  type WordpressImportMode,
  type WordpressImportOptions,
} from "../lib/integrations/wordpress/orderImport";
import { runHistoricalGsmPodBackfill } from "./backfill-historical-gsm-pod-attachments";

type FullImportOptions = WordpressImportOptions & {
  skipWordpressAttachments: boolean;
  skipGsmPods: boolean;
  gsmLimit: number | null;
  forceGsmPods: boolean;
};

function parsePositiveInteger(name: string, value: string | undefined): number {
  if (!value) {
    throw new Error(`${name} requires a value`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseFullImportArgs(argv: string[]): FullImportOptions {
  const options: FullImportOptions = {
    mode: "dry-run",
    fromPage: 1,
    limitPages: null,
    orderId: null,
    debug: false,
    skipWordpressAttachments: false,
    skipGsmPods: false,
    gsmLimit: null,
    forceGsmPods: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--apply") {
      options.mode = "apply";
      continue;
    }

    if (arg === "--dry-run") {
      options.mode = "dry-run";
      continue;
    }

    if (arg === "--debug") {
      options.debug = true;
      continue;
    }

    if (arg === "--skip-wordpress-attachments") {
      options.skipWordpressAttachments = true;
      continue;
    }

    if (arg === "--skip-gsm-pods") {
      options.skipGsmPods = true;
      continue;
    }

    if (arg === "--force-gsm-pods") {
      options.forceGsmPods = true;
      continue;
    }

    if (arg === "--from-page") {
      options.fromPage = parsePositiveInteger("--from-page", next);
      index += 1;
      continue;
    }

    if (arg === "--limit-pages") {
      options.limitPages = parsePositiveInteger("--limit-pages", next);
      index += 1;
      continue;
    }

    if (arg === "--order-id") {
      options.orderId = parsePositiveInteger("--order-id", next);
      index += 1;
      continue;
    }

    if (arg === "--gsm-limit") {
      options.gsmLimit = parsePositiveInteger("--gsm-limit", next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getWordpressOptions(options: FullImportOptions): WordpressImportOptions {
  return {
    mode: options.mode,
    fromPage: options.fromPage,
    limitPages: options.limitPages,
    orderId: options.orderId,
    debug: options.debug,
  };
}

function toBackfillMode(mode: WordpressImportMode) {
  return mode;
}

async function main() {
  const options = parseFullImportArgs(process.argv.slice(2));
  const wordpressOptions = getWordpressOptions(options);
  let failed = false;

  console.log("Historical full import starting", options);

  const orderSummary = await runWordpressOrderImport(wordpressOptions);
  console.log("Historical full import: WordPress orders complete", orderSummary);
  failed ||= orderSummary.failed > 0;

  if (!options.skipWordpressAttachments) {
    const attachmentSummary =
      await runWordpressAttachmentImport(wordpressOptions);
    console.log(
      "Historical full import: WordPress attachments complete",
      attachmentSummary,
    );
    failed ||= attachmentSummary.failed > 0;
  }

  if (!options.skipGsmPods) {
    const gsmSummary = await runHistoricalGsmPodBackfill({
      mode: toBackfillMode(options.mode),
      limit: options.gsmLimit,
      legacyWordpressOrderId: options.orderId,
      force: options.forceGsmPods,
      debug: options.debug,
    });
    console.log("Historical full import: GSM POD backfill complete", gsmSummary);
    failed ||= gsmSummary.failed > 0;
  }

  if (options.mode === "apply") {
    const verification = await verifyWordpressOrderImport();
    console.log("Historical full import: verification", verification);
    failed ||=
      verification.wordpressTotal !== null &&
      verification.wordpressTotal !== verification.importedTotal;
  }

  console.log("Historical full import complete", {
    mode: options.mode,
    failed,
  });

  if (failed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Historical full import crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
