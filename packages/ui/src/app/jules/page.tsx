"use client";

import { Suspense } from "react";
import { useJules } from "@/lib/jules/provider";
import { AppLayout } from "@/components/app-layout";

export default function JulesPage() {
  const { isLoading } = useJules();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-sm font-mono text-muted-foreground animate-pulse">
          Initializing...
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppLayout />
    </Suspense>
  );
}
