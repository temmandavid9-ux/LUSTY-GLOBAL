export interface SplitResult {
  grossAmount: number;
  platformFee: number;
  hostNetPayout: number;
}

export function calculateSplit(grossAmount: number): SplitResult {
  const sanitizedGross = Math.max(0, Number(grossAmount) || 0);
  const platformFee = Number((sanitizedGross * 0.15).toFixed(2));
  const hostNetPayout = Number((sanitizedGross - platformFee).toFixed(2));

  return {
    grossAmount: sanitizedGross,
    platformFee,
    hostNetPayout,
  };
}
