"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "wagmi";
import { chain, PRIVY_APP_ID } from "@/lib/config";

const queryClient = new QueryClient();
const wagmiConfig = createConfig({ chains: [chain], transports: { [chain.id]: http() } });

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: chain,
        supportedChains: [chain],
        loginMethods: ["wallet", "email", "google"],
        appearance: { theme: "dark", accentColor: "#B6FF1A" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
