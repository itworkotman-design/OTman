import type { Metadata } from "next";
import LoginPageContent from "../LoginPageContent";

export const metadata: Metadata = {
  title: "Logg inn | Otman AS",
};

export default function LoginPage() {
  return <LoginPageContent />;
}
