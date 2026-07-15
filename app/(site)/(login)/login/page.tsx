import type { Metadata } from "next";
import LoginPageContent from "../LoginPageContent";

export const metadata: Metadata = {
  title: "Logg inn | Otman AS",
  description: "Logg inn på din Otman AS-konto for å administrere bestillinger, bilutleie og bedriftsinformasjon.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return <LoginPageContent />;
}
