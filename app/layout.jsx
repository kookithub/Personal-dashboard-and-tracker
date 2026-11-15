import { DM_Sans, IBM_Plex_Mono, Instrument_Serif, Inter, JetBrains_Mono, Nunito, Playfair_Display, Space_Grotesk } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { EmbedHost } from "@/components/EmbedHost";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
// Extra fonts for the "Rounded" and "Typewriter" styles (Settings > Look); only downloaded when used.
const round = Nunito({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-nunito", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-jetbrains", display: "swap", preload: false });
// Fonts of the Hyper and Zeus modes (Settings > Look > Mode); also only downloaded when used.
const hyperSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap", preload: false });
const hyperSans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const zeusSans = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", preload: false });
const zeusMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap", preload: false });

export const metadata = {
  title: "Home",
  description: "Projects, classes and life in one place",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  // Served from the logo you pick in Settings > Look (falls back to the files in /public).
  icons: { icon: "/api/icon/icon-192.png", apple: "/api/icon/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Home", statusBarStyle: "black-translucent" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ece7e1",
};

// Sets light/dark and the saved look (theme, font style, corners, backdrop, decoration) before the page
// draws, so it doesn't flash. Older saved values: "auto" follows the device, "hyper" is dark, "zeus" light.
const themeScript = `try{var t=localStorage.getItem("k-theme"),d=t==="dark"||t==="hyper"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.body.className+=(d?" theme-dark ":" theme-light ")+(localStorage.getItem("k-look")||"")}catch(e){document.body.className+=" theme-light"}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={[sans, serif, round, mono, hyperSerif, hyperSans, zeusSans, zeusMono].map((f) => f.variable).join(" ")}>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div id="app">
          <AppProvider><EmbedHost>{children}</EmbedHost></AppProvider>
        </div>
      </body>
    </html>
  );
}
