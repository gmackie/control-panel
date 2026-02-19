import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "GMAC.IO Control Panel",
  description: "Application deployment dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
