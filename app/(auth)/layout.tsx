// Auth route group layout — centered, minimal shell for login/register.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  );
}
