import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/session";
import "./globals.css";
import "./styles/motion.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/home.css";

// Open-licensed stand-in (SIL OFL, see fonts/Figtree-OFL.txt) until the licensed
// brand font files are placed in /public/fonts. Visby stays first in the stack.
const fallbackSans = localFont({
  src: "./fonts/Figtree-Variable.woff2",
  weight: "300 900",
  variable: "--font-fallback",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "New Friendship Tech", template: "%s · New Friendship Tech" },
  description:
    "A network built on life changing experiences. Members meet over dinners, shows, and trips.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fallbackSans.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
