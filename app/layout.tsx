import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        </body>
    </html>
  );
}
