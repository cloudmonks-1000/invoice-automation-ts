import "../src/index.css";
import "../src/App.css";

export const metadata = {
  title: "Invoice Automation",
  description: "Invoice automation system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}