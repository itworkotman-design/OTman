import { Suspense } from "react";
import AcceptInviteClient from "./AcceptInviteClient";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <AcceptInviteClient />
    </Suspense>
  );
}