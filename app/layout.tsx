import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "雑談のタネ🌱",
  description: "会話に花を咲かせましょう🌸",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header />
        {/* <div className="px-3 pt-3 pb-9 max-w-[680px] my-0 mx-auto"> */}
        <div className="max-w-4xl my-0 mx-auto">{children}</div>
      </body>
    </html>
  );
}
