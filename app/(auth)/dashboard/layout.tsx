export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  );
}
