"use client";

import { useEffect } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, useSetActiveWallet } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, useAccount } from "wagmi";
import { chain, PRIVY_APP_ID } from "@/lib/config";

const queryClient = new QueryClient();
// All reads of a render go out as one multicall in one JSON-RPC batch: fewer requests, fewer failures.
const wagmiConfig = createConfig({
  chains: [chain],
  transports: { [chain.id]: http(undefined, { batch: true }) },
  batch: { multicall: true },
});

/**
 * After an email or Google login, transactions must use the Privy embedded wallet. Otherwise wagmi can
 * pick another linked wallet (for example MetaMask on the phone) and send the user to that app.
 */
function PreferEmbeddedWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address } = useAccount();
  useEffect(() => {
    if (!ready || !authenticated) return;
    const viaEmailOrGoogle = !!(user?.email || user?.google);
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    if (viaEmailOrGoogle && embedded && address?.toLowerCase() !== embedded.address.toLowerCase()) {
      setActiveWallet(embedded);
    }
  }, [ready, authenticated, user, wallets, address, setActiveWallet]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: chain,
        supportedChains: [chain],
        loginMethods: ["wallet", "email", "google"],
        appearance: { theme: "dark", accentColor: "#B6FF1A" },
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } }, // every login gets a Privy wallet, so email/Google never needs MetaMask
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <PreferEmbeddedWallet />
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
