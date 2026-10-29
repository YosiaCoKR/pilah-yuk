import { Suspense } from "react";
import { TabBawah, TabBawahRangka } from "@/components/tab-bawah";

export default function UtamaLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-screen-sm flex-1 px-4 pb-8 pt-4">
        {children}
      </div>
      <Suspense fallback={<TabBawahRangka />}>
        <TabBawah />
      </Suspense>
    </div>
  );
}
