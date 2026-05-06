import { NextResponse } from "next/server";
import { syncGmailOrderConversations } from "@/lib/email/gmailSync";

export async function POST() {
  try {
    const result = await syncGmailOrderConversations();

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "GMAIL_SYNC_FAILED";

    return NextResponse.json(
      {
        ok: false,
        reason,
      },
      { status: 500 },
    );
  }
}
