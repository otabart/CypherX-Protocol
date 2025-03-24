// pages/api/token-holders.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { tokenAddress } = req.query;

  if (!tokenAddress) {
    return res.status(400).json({ error: 'tokenAddress is required' });
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  const alchemyURL = `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  const response = await fetch(`${alchemyURL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getTokenBalances",
      params: [tokenAddress],
    }),
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: "Alchemy API error." });
  }

  const data = await response.json();
  res.status(200).json(data);
}
