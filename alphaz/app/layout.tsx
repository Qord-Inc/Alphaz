import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { UserSync } from "@/components/user-sync";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import "./globals.css";
import { PostHogProvider } from '@/contexts/PostHogContext';



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alphaz - LinkedIn Analytics",
  description: "Track your LinkedIn performance and insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <PostHogProvider>
          <UserSync>
            <OrganizationProvider>
              {children}
            </OrganizationProvider>
          </UserSync>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
