import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

import "./site.css";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="site-ui flex min-h-full flex-col">
      <SiteHeader />
      <div className="flex flex-1 flex-col overflow-x-clip bg-background pt-14">{children}</div>
      <SiteFooter />
    </div>
  );
}
