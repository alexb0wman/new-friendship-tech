const checks = [
  ["Sepolia", "https://ethereum-sepolia-rpc.publicnode.com", 11155111],
  ["0G mainnet", process.env.PAYMENT_RPC_URL || "https://evmrpc.0g.ai", 16661],
];

for (const [name, url, expected] of checks) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
  const body = await response.json();
  const chainId = Number(body.result);
  console.log(`${name}: chain ${chainId} ${chainId === expected ? "ok" : "MISMATCH"} via ${url}`);
}

const missing = ["NEXT_PUBLIC_PRIVY_APP_ID", "PRIVY_APP_SECRET", "PAYMENT_RECIPIENT", "ENS_SEPOLIA_RPC_URL"].filter(
  (key) => !process.env[key],
);
console.log(missing.length ? `still required: ${missing.join(", ")}` : "operator secrets are present");
console.log("checkout stays closed until a real receipt is verified against PAYMENT_RECIPIENT");
