/**
 * Policy Engine
 *
 * Machine-readable business policies that agents can evaluate
 * before making recommendations or completing transactions.
 *
 * Returns policies: eligible for return? What's the shipping cost?
 * Can this promo code be applied? What's the price match window?
 */

export interface ReturnPolicy {
  windowDays: number;
  freeReturn: boolean;
  conditions: string[];
  excludedCategories: string[];
  process: string;
}

export interface ShippingPolicy {
  standard: { price: number; estimatedDays: string };
  express: { price: number; estimatedDays: string };
  freeThreshold: number;
  international: boolean;
  internationalCountries?: string[];
}

export interface PriceMatchPolicy {
  enabled: boolean;
  windowDays: number;
  competitors: string[];  // "authorized retailers" or specific names
  conditions: string[];
}

export interface LoyaltyPolicy {
  enabled: boolean;
  pointsPerDollar: number;
  redemptionRate: number;  // points per $1 discount
  tiers: Array<{ name: string; minSpend: number; multiplier: number }>;
}

export interface PolicyConfig {
  returns: ReturnPolicy;
  shipping: ShippingPolicy;
  priceMatch: PriceMatchPolicy;
  loyalty: LoyaltyPolicy;
  dataHandling: string;
  rateLimit: string;
  termsUrl: string;
  privacyUrl: string;
}

export const DEFAULT_POLICIES: PolicyConfig = {
  returns: {
    windowDays: 30,
    freeReturn: true,
    conditions: [
      "Items must be unworn with tags attached",
      "Swimwear and intimates are final sale",
      "Sale items can be exchanged but not refunded",
    ],
    excludedCategories: ["swimwear", "intimates", "gift_cards"],
    process: "Initiate return online or contact support. Prepaid label provided within 24 hours.",
  },
  shipping: {
    standard: { price: 9.99, estimatedDays: "5-7 business days" },
    express: { price: 19.99, estimatedDays: "2-3 business days" },
    freeThreshold: 75,
    international: true,
    internationalCountries: ["CA", "GB", "AU", "DE", "FR", "JP"],
  },
  priceMatch: {
    enabled: true,
    windowDays: 14,
    competitors: ["authorized retailers"],
    conditions: [
      "Item must be identical (same color, size, style)",
      "Competitor must have item in stock",
      "Does not apply to clearance or flash sales",
    ],
  },
  loyalty: {
    enabled: true,
    pointsPerDollar: 1,
    redemptionRate: 100, // 100 points = $1
    tiers: [
      { name: "Member", minSpend: 0, multiplier: 1 },
      { name: "Silver", minSpend: 500, multiplier: 1.5 },
      { name: "Gold", minSpend: 1500, multiplier: 2 },
      { name: "Platinum", minSpend: 5000, multiplier: 3 },
    ],
  },
  dataHandling: "no_training_on_interactions",
  rateLimit: "100/minute",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
};

// ─── Policy Evaluator ────────────────────────────────────────

export class PolicyEngine {
  private config: PolicyConfig;

  constructor(config?: Partial<PolicyConfig>) {
    this.config = { ...DEFAULT_POLICIES, ...config };
  }

  canReturn(item: { category: string; purchaseDate: string; worn: boolean }): {
    eligible: boolean;
    reason: string;
    deadline: string;
  } {
    const purchaseDate = new Date(item.purchaseDate);
    const deadline = new Date(purchaseDate);
    deadline.setDate(deadline.getDate() + this.config.returns.windowDays);
    const now = new Date();

    if (now > deadline) {
      return {
        eligible: false,
        reason: `Return window expired. Deadline was ${deadline.toISOString().split("T")[0]}.`,
        deadline: deadline.toISOString().split("T")[0]!,
      };
    }

    if (this.config.returns.excludedCategories.includes(item.category)) {
      return {
        eligible: false,
        reason: `${item.category} items are final sale and cannot be returned.`,
        deadline: deadline.toISOString().split("T")[0]!,
      };
    }

    if (item.worn) {
      return {
        eligible: false,
        reason: "Items must be unworn with tags attached.",
        deadline: deadline.toISOString().split("T")[0]!,
      };
    }

    return {
      eligible: true,
      reason: `Eligible for ${this.config.returns.freeReturn ? "free " : ""}return.`,
      deadline: deadline.toISOString().split("T")[0]!,
    };
  }

  calculateShipping(subtotal: number, method: "standard" | "express" = "standard"): {
    cost: number;
    estimatedDays: string;
    freeShipping: boolean;
  } {
    const freeShipping = subtotal >= this.config.shipping.freeThreshold;
    const shippingInfo = this.config.shipping[method];

    return {
      cost: freeShipping && method === "standard" ? 0 : shippingInfo.price,
      estimatedDays: shippingInfo.estimatedDays,
      freeShipping: freeShipping && method === "standard",
    };
  }

  canPriceMatch(item: { price: number; competitorPrice: number; competitorName: string; purchaseDate: string }): {
    eligible: boolean;
    savings: number;
    reason: string;
  } {
    if (!this.config.priceMatch.enabled) {
      return { eligible: false, savings: 0, reason: "Price matching is not available." };
    }

    const purchaseDate = new Date(item.purchaseDate);
    const deadline = new Date(purchaseDate);
    deadline.setDate(deadline.getDate() + this.config.priceMatch.windowDays);

    if (new Date() > deadline) {
      return { eligible: false, savings: 0, reason: `Price match window expired (${this.config.priceMatch.windowDays} days from purchase).` };
    }

    if (item.competitorPrice >= item.price) {
      return { eligible: false, savings: 0, reason: "Competitor price is not lower." };
    }

    const savings = Math.round((item.price - item.competitorPrice) * 100) / 100;
    return { eligible: true, savings, reason: `Eligible for $${savings} price adjustment.` };
  }

  getLoyaltyInfo(totalSpend: number): {
    tier: string;
    multiplier: number;
    nextTier: string | null;
    spendToNextTier: number;
    pointsEarned: number;
  } {
    const tiers = this.config.loyalty.tiers;
    let currentTier = tiers[0]!;

    for (const tier of tiers) {
      if (totalSpend >= tier.minSpend) currentTier = tier;
    }

    const currentIdx = tiers.indexOf(currentTier);
    const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

    return {
      tier: currentTier.name,
      multiplier: currentTier.multiplier,
      nextTier: nextTier?.name || null,
      spendToNextTier: nextTier ? Math.max(0, nextTier.minSpend - totalSpend) : 0,
      pointsEarned: Math.round(totalSpend * this.config.loyalty.pointsPerDollar * currentTier.multiplier),
    };
  }

  getAllPolicies(): PolicyConfig {
    return this.config;
  }

  formatForAgent(): string {
    const c = this.config;
    return [
      `**Returns:** ${c.returns.windowDays}-day window. ${c.returns.freeReturn ? "Free return shipping." : "Customer pays return shipping."} ${c.returns.conditions.join(". ")}.`,
      `**Shipping:** Free standard over $${c.shipping.freeThreshold}. Standard: $${c.shipping.standard.price} (${c.shipping.standard.estimatedDays}). Express: $${c.shipping.express.price} (${c.shipping.express.estimatedDays}).`,
      c.priceMatch.enabled ? `**Price Match:** ${c.priceMatch.windowDays}-day window from purchase. ${c.priceMatch.conditions.join(". ")}.` : "",
      c.loyalty.enabled ? `**Loyalty:** ${c.loyalty.pointsPerDollar} point per $1. Tiers: ${c.loyalty.tiers.map(t => `${t.name} ($${t.minSpend}+ = ${t.multiplier}x)`).join(", ")}.` : "",
    ].filter(Boolean).join("\n\n");
  }
}
