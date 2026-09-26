import type { Metadata } from "next";
import { Providers } from "@/components/session";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "New Friendship Tech", template: "%s · New Friendship Tech" },
  description:
    "A network built on life changing experiences. Members meet over dinners, shows, and trips.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
