"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";

export function Topbar({ name, email }: { name?: string | null; email?: string | null }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="text-sm text-muted-foreground">
        {/* Breadcrumb slot could go here */}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {initials(name ?? undefined, email ?? undefined)}
          </div>
          <div className="hidden text-sm leading-tight sm:block">
            <div className="font-medium">{name ?? "User"}</div>
            <div className="text-xs text-muted-foreground">{email}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
