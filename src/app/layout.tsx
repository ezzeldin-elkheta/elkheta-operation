// This is a minimal layout for Next.js App Router API routes only
// The main app still uses Vite/React Router

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
