/** Spendable balances from credit_ledger, the same sums the wallet displays. */

export interface LedgerBalances {
  balance: number;
  genesis_balance: number;
  earned_balance: number;
}

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function ledgerBalances(client: RpcClient, userId: string): Promise<LedgerBalances> {
  const { data, error } = await client.rpc("credit_ledger_balances", { p_user_id: userId });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Partial<LedgerBalances>;
  return {
    balance: Number(row.balance ?? 0),
    genesis_balance: Number(row.genesis_balance ?? 0),
    earned_balance: Number(row.earned_balance ?? 0),
  };
}
