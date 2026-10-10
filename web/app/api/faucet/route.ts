import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "@/lib/abi";
import { AUSD, chain } from "@/lib/config";

const FAUCET = (process.env.NEXT_PUBLIC_FAUCET ?? "").match(/0x[0-9a-fA-F]{40}/)?.[0] as `0x${string}` | undefined;
const faucetAbi = [
  { type: "function", name: "drip", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [] },
  { type: "function", name: "canDrip", stateMutability: "view", inputs: [{ name: "to", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

/**
 * Gasless faucet: a new user has no MON, so our operator sends drip(user).
 * Only for (nearly) empty wallets; the contract adds a per-address cooldown and a daily cap.
 */
export async function POST(req: Request) {
  const pk = process.env.FAUCET_PK;
  if (!pk || !FAUCET) return NextResponse.json({ status: "off" }, { status: 503 });
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !isAddress(address)) return NextResponse.json({ status: "bad-address" }, { status: 400 });

  const transport = http(process.env.MONAD_RPC_URL || undefined);
  const client = createPublicClient({ chain, transport });
  const [usd, mon, can] = await Promise.all([
    client.readContract({ address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.getBalance({ address }),
    client.readContract({ address: FAUCET, abi: faucetAbi, functionName: "canDrip", args: [address] }),
  ]);
  if (usd >= 50_000_000n && mon >= parseEther("0.02")) return NextResponse.json({ status: "not-needed" });
  if (!can) return NextResponse.json({ status: "cooldown" });

  try {
    const wallet = createWalletClient({ chain, transport, account: privateKeyToAccount(pk as `0x${string}`) });
    const hash = await wallet.writeContract({ address: FAUCET, abi: faucetAbi, functionName: "drip", args: [address] });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return NextResponse.json({ status: "failed" }, { status: 502 });
    return NextResponse.json({ status: "ok", hash });
  } catch {
    return NextResponse.json({ status: "failed" }, { status: 502 });
  }
}
