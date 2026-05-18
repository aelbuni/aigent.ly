"use client";

import { SidebarProvider } from "@/components/nextadmin/layouts/sidebar/sidebar-context";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { Session } from "next-auth";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";

export function AdminProviders({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <SidebarProvider defaultOpen>
          <NextTopLoader color="#5750F1" showSpinner={false} />
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              className:
                "dark:bg-gray-dark dark:border-dark-3 dark:text-white",
            }}
          />
        </SidebarProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
