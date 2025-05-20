"use client";

import { SafeAreaContainer } from "@/components/safe-area-container";
import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import dynamic from "next/dynamic";
import { FrameProvider } from "@/components/farcaster-provider";

const Demo = dynamic(() => import("@/components/Home"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function Home() {
  const { context } = useMiniAppContext();
  return (
    <FrameProvider>
      <SafeAreaContainer insets={context?.client.safeAreaInsets}>
        <Demo />
      </SafeAreaContainer>
    </FrameProvider>
  );
}
