import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradebook | ระบบจัดการคะแนน",
  description: "ระบบบันทึกคะแนน ประมวลผลเกรด และออกรายงานผลการเรียน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
