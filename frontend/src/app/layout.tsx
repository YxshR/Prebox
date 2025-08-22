import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RouteTransition } from "../components/common/PageTransition";
import { PageErrorBoundary } from "../components/common/ErrorBoundary";
import { SecurityMonitor } from "../components/common/SecurityMonitor";
import { PerformanceProvider } from "../components/common/PerformanceProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BulkEmail Platform - Professional Email Marketing",
  description: "Send bulk emails with ease. Professional email marketing platform with AI templates, analytics, and multi-tier pricing.",
  // Security meta tags - Note: X-Frame-Options removed as it should be set via HTTP headers only
  other: {
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Additional security meta tags - Note: X-Frame-Options removed as it should be set via HTTP headers only */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PerformanceProvider>
          <PageErrorBoundary>
            <RouteTransition>
              {children}
            </RouteTransition>
            {/* Security Monitor - only shows in development */}
            <SecurityMonitor position="bottom-left" minimized={true} />
          </PageErrorBoundary>
        </PerformanceProvider>
      </body>
    </html>
  );
}
