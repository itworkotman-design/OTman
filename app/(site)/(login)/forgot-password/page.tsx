import type { Metadata } from "next";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Glemt passord | Otman AS",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
