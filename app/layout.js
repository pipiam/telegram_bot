export const metadata = {
  title: "Telegram Dashboard",
  description: "Live Telegram group messages"
};

import "../styles/globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
