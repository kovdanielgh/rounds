"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "wagmi";
import { chain, PRIVY_APP_ID } from "@/lib/config";

const queryClient = new QueryClient();
// All reads of a render go out as one multicall in one JSON-RPC batch: fewer requests, fewer failures.
const wagmiConfig = createConfig({
  chains: [chain],
  transports: { [chain.id]: http(undefined, { batch: true }) },
  batch: { multicall: true },
});

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
