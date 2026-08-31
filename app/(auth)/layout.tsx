import { Mail } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Gmail Automation Platform</h1>
          <p className="text-sm text-muted-foreground">
            Send smarter from your own Gmail.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
