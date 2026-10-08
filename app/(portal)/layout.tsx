import { Suspense } from "react";
import { Shell } from "@/components/Shell";

export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
