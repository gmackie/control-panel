import "./globals.css";
import { Providers } from "./providers";
import MainLayout from "@/components/layout/main-layout";

export const metadata = {
  title: "GMAC.IO - Infrastructure Control Panel",
  description: "Complete infrastructure management and monitoring platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`bg-background text-foreground min-h-screen`}>
        <Providers>
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
