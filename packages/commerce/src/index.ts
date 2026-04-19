#!/usr/bin/env node
/**
 * AgentWeb Commerce — MCP Server
 *
 * The "Shopify for agent commerce". An MCP server that lets brands
 * publish structured catalogs, pricing, policies, and brand voice
 * in formats AI agents can negotiate with.
 *
 * Usage:
 *   npx agentweb-commerce [options]
 *
 * Options:
 *   --port <n>           Port to listen on (default: 3001)
 *   --brand <name>       Brand name
 *   --catalog <file>     Path to catalog JSON file
 *   --policies <file>    Path to policies JSON file
 *   --help, -h           Show this help
 *
 * Env vars (used when flag is not provided):
 *   PORT, BRAND_NAME, CATALOG_FILE, POLICIES_FILE
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { CatalogStore, CartManager, negotiate, type Product, type NegotiationIntent } from "./services/catalog.js";
import { PolicyEngine, type PolicyConfig } from "./services/policies.js";

// ─── CLI Argument Parsing ────────────────────────────────────

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`
  AgentWeb Commerce — MCP server for agent-driven commerce

  Usage:
    npx agentweb-commerce [options]

  Options:
    --port <n>           Port to listen on (default: 3001)
    --brand <name>       Brand name shown to agents
    --catalog <file>     Path to catalog JSON file (falls back to demo catalog)
    --policies <file>    Path to policies JSON file
    --help, -h           Show this help

  Environment variables (used when a flag is not provided):
    PORT, BRAND_NAME, CATALOG_FILE, POLICIES_FILE

  Examples:
    npx agentweb-commerce --brand "Acme" --catalog ./products.json
    CATALOG_FILE=./products.json npx agentweb-commerce
`);
  process.exit(0);
}

function getArg(flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
}

// ─── Configuration ───────────────────────────────────────────

const portArg = getArg("--port");
const brandArg = getArg("--brand");
const catalogArg = getArg("--catalog");
const policiesArg = getArg("--policies");

const PORT = parseInt(portArg || process.env.PORT || "3001");
const BRAND_NAME = brandArg || process.env.BRAND_NAME || "Commerce Store";
const CATALOG_FILE = catalogArg || process.env.CATALOG_FILE;
const POLICIES_FILE = policiesArg || process.env.POLICIES_FILE;

// ─── Demo Products ───────────────────────────────────────────

const DEMO_PRODUCTS: Product[] = [
  {
    id: "prod_001", name: "Riviera Linen Blazer", description: "Lightweight linen blazer perfect for warm weather", agentDescription: "Unstructured linen blazer in a relaxed fit. Best for summer events, outdoor weddings, or smart-casual settings. Runs true to size. Pairs well with chinos or tailored shorts.",
    category: "women", subcategory: "outerwear", price: 185, currency: "USD", availability: "in_stock", stockCount: 42,
    images: [], url: "https://example.com/products/riviera-blazer", brand: "Acme Fashion",
    tags: ["blazer", "linen", "summer", "wedding"], attributes: { size: ["XS", "S", "M", "L", "XL"], color: ["Navy", "Cream", "Sage"] },
    rating: 4.6, reviewCount: 128, sustainable: true, occasions: ["wedding", "business_casual", "summer_event"],
    relatedProducts: ["prod_002", "prod_005"], createdAt: "2026-03-01", updatedAt: "2026-04-10",
  },
  {
    id: "prod_002", name: "Silk Midi Dress", description: "Flowing silk midi dress", agentDescription: "100% mulberry silk midi dress with a flattering A-line silhouette. Ideal for weddings, date nights, or elevated everyday wear. Has pockets. Dry clean only.",
    category: "women", subcategory: "dresses", price: 245, currency: "USD", compareAtPrice: 320, availability: "low_stock", stockCount: 8,
    images: [], url: "https://example.com/products/silk-midi", brand: "Acme Fashion",
    tags: ["dress", "silk", "midi", "wedding", "sale"], attributes: { size: ["XS", "S", "M", "L"], color: ["Midnight", "Blush", "Emerald"] },
    rating: 4.8, reviewCount: 89, sustainable: true, occasions: ["wedding", "date_night", "formal"],
    relatedProducts: ["prod_001", "prod_003"], createdAt: "2026-02-15", updatedAt: "2026-04-08",
  },
  {
    id: "prod_003", name: "Cotton Chinos", description: "Classic cotton chino pants", agentDescription: "Organic cotton chinos with a modern slim fit. Versatile everyday pants that work for office or weekend. Machine washable. Available in 6 colors.",
    category: "men", subcategory: "pants", price: 89, currency: "USD", availability: "in_stock", stockCount: 156,
    images: [], url: "https://example.com/products/cotton-chinos", brand: "Acme Fashion",
    tags: ["chinos", "cotton", "casual", "office"], attributes: { size: ["28", "30", "32", "34", "36", "38"], color: ["Khaki", "Navy", "Olive", "Black", "Stone", "Burgundy"] },
    rating: 4.5, reviewCount: 312, sustainable: true, occasions: ["casual", "business_casual", "office"],
    createdAt: "2026-01-10", updatedAt: "2026-04-12",
  },
  {
    id: "prod_004", name: "Cashmere Crewneck", description: "Grade-A cashmere sweater", agentDescription: "Ultra-soft Grade-A Mongolian cashmere crewneck. Lightweight enough for layering, warm enough for winter. Hand wash recommended. Timeless staple.",
    category: "women", subcategory: "knitwear", price: 195, currency: "USD", availability: "in_stock", stockCount: 67,
    images: [], url: "https://example.com/products/cashmere-crew", brand: "Acme Fashion",
    tags: ["cashmere", "sweater", "knitwear", "luxury"], attributes: { size: ["XS", "S", "M", "L", "XL"], color: ["Camel", "Black", "Heather Grey", "Ivory"] },
    rating: 4.9, reviewCount: 201, sustainable: false, occasions: ["casual", "office", "date_night"],
    createdAt: "2025-10-20", updatedAt: "2026-03-15",
  },
  {
    id: "prod_005", name: "Canvas Tote Bag", description: "Oversized canvas tote", agentDescription: "Heavy-duty organic canvas tote with leather handles. Fits a 15-inch laptop. Interior zip pocket. Great for everyday carry or beach days.",
    category: "accessories", subcategory: "bags", price: 65, currency: "USD", availability: "in_stock", stockCount: 234,
    images: [], url: "https://example.com/products/canvas-tote", brand: "Acme Fashion",
    tags: ["bag", "tote", "canvas", "everyday"], attributes: { color: ["Natural", "Black", "Navy"] },
    rating: 4.4, reviewCount: 178, sustainable: true, occasions: ["casual", "travel", "beach"],
    createdAt: "2026-02-01", updatedAt: "2026-04-05",
  },
  {
    id: "prod_006", name: "Leather Chelsea Boots", description: "Classic leather chelsea boots", agentDescription: "Full-grain leather Chelsea boots with elastic side panels and rubber sole. Break-in period of about a week. Resoleable. Goes with everything from jeans to suits.",
    category: "shoes", subcategory: "boots", price: 225, currency: "USD", availability: "in_stock", stockCount: 45,
    images: [], url: "https://example.com/products/chelsea-boots", brand: "Acme Fashion",
    tags: ["boots", "leather", "chelsea", "classic"], attributes: { size: ["7", "8", "9", "10", "11", "12", "13"], color: ["Black", "Brown", "Tan"] },
    rating: 4.7, reviewCount: 156, sustainable: false, occasions: ["business", "casual", "date_night"],
    createdAt: "2025-09-01", updatedAt: "2026-04-01",
  },
];

// Load catalog
const catalog = new CatalogStore();
const cartManager = new CartManager(catalog);

if (CATALOG_FILE) {
  try {
    const fs = await import("fs");
    const products: Product[] = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf-8"));
    catalog.load(products);
    console.error(`Loaded ${products.length} products from ${CATALOG_FILE}`);
  } catch (e) {
    console.error(`Warning: Could not load catalog: ${e}`);
  }
} else {
  // Load demo catalog
  catalog.load(DEMO_PRODUCTS);
  console.error(`Loaded ${DEMO_PRODUCTS.length} demo products`);
}

// Load policies
let policyConfig: Partial<PolicyConfig> = {};
if (POLICIES_FILE) {
  try {
    const fs = await import("fs");
    policyConfig = JSON.parse(fs.readFileSync(POLICIES_FILE, "utf-8"));
  } catch (e) {
    console.error(`Warning: Could not load policies: ${e}`);
  }
}
const policies = new PolicyEngine(policyConfig);

// ─── MCP Server ──────────────────────────────────────────────

const server = new McpServer({
  name: `${BRAND_NAME}-commerce`,
  version: "0.1.0",
});

// ─── Tool: Search products ───────────────────────────────────

server.registerTool(
  "search_products",
  {
    title: "Search products",
    description: `Search the ${BRAND_NAME} product catalog. Supports natural language queries, category filtering, price ranges, size/color attributes, and occasion-based search. Returns product details including availability, pricing, and ratings.`,
    inputSchema: {
      query: z.string().optional().describe("Natural language search (e.g., 'summer dress under $200')"),
      category: z.string().optional().describe("Product category"),
      min_price: z.number().optional().describe("Minimum price"),
      max_price: z.number().optional().describe("Maximum price"),
      size: z.array(z.string()).optional().describe("Size filter (e.g., ['S', 'M'])"),
      color: z.string().optional().describe("Color filter"),
      occasion: z.string().optional().describe("Occasion (e.g., 'wedding', 'casual', 'business')"),
      sustainable_only: z.boolean().optional().describe("Only sustainable products"),
      limit: z.number().int().min(1).max(20).default(5).describe("Max results"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (params) => {
    const { products, total } = catalog.search({
      query: params.query,
      category: params.category,
      minPrice: params.min_price,
      maxPrice: params.max_price,
      attributes: {
        ...(params.size ? { size: params.size } : {}),
        ...(params.color ? { color: params.color } : {}),
      },
      occasion: params.occasion,
      sustainable: params.sustainable_only,
    });

    const limited = products.slice(0, params.limit);

    if (limited.length === 0) {
      return { content: [{ type: "text" as const, text: `No products found${params.query ? ` for "${params.query}"` : ""}. Try broadening your search.` }] };
    }

    let result = `**${total} products found** (showing ${limited.length}):\n\n`;
    for (const p of limited) {
      const sale = p.compareAtPrice ? ` ~~$${p.compareAtPrice}~~` : "";
      const badge = p.sustainable ? " 🌿" : "";
      result += `**${p.name}**${badge} — $${p.price}${sale} — ${p.availability.replace("_", " ")}\n`;
      result += `${p.agentDescription}\n`;
      if (p.rating) result += `Rating: ${p.rating}/5 (${p.reviewCount} reviews)\n`;
      result += `ID: ${p.id} | ${p.url}\n\n`;
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Get product details ───────────────────────────────

server.registerTool(
  "get_product",
  {
    title: "Get product details",
    description: "Get full details for a specific product by ID, including all attributes, availability, and related products.",
    inputSchema: {
      product_id: z.string().describe("Product ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ product_id }) => {
    const product = catalog.get(product_id);
    if (!product) {
      return { content: [{ type: "text" as const, text: `Product ${product_id} not found.` }], isError: true };
    }

    const related = catalog.getRelated(product_id, 3);

    let result = `**${product.name}** — $${product.price}\n\n`;
    result += `${product.agentDescription}\n\n`;
    result += `**Category:** ${product.category}${product.subcategory ? ` > ${product.subcategory}` : ""}\n`;
    result += `**Availability:** ${product.availability.replace("_", " ")}`;
    if (product.stockCount !== undefined) result += ` (${product.stockCount} in stock)`;
    result += "\n";
    if (product.compareAtPrice) result += `**Sale:** Was $${product.compareAtPrice}, now $${product.price}\n`;
    if (product.brand) result += `**Brand:** ${product.brand}\n`;
    if (product.rating) result += `**Rating:** ${product.rating}/5 (${product.reviewCount} reviews)\n`;
    if (product.sustainable) result += `**Sustainable:** Yes\n`;

    const attrs = Object.entries(product.attributes);
    if (attrs.length > 0) {
      result += `\n**Attributes:**\n`;
      for (const [key, val] of attrs) {
        result += `- ${key}: ${Array.isArray(val) ? val.join(", ") : val}\n`;
      }
    }

    if (product.occasions?.length) {
      result += `\n**Occasions:** ${product.occasions.join(", ")}\n`;
    }

    if (related.length > 0) {
      result += `\n**You might also like:**\n`;
      for (const r of related) {
        result += `- ${r.name} — $${r.price} (${r.id})\n`;
      }
    }

    result += `\n**URL:** ${product.url}\n`;

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Cart operations ───────────────────────────────────

server.registerTool(
  "manage_cart",
  {
    title: "Manage shopping cart",
    description: "Create a cart, add/remove items, apply promo codes, and view cart totals. Use this to build an order before checkout.",
    inputSchema: {
      action: z.enum(["create", "add", "remove", "view", "apply_promo"]).describe("Cart action"),
      cart_id: z.string().optional().describe("Cart ID (required for all actions except create)"),
      product_id: z.string().optional().describe("Product ID (for add/remove)"),
      quantity: z.number().int().min(1).default(1).describe("Quantity (for add)"),
      size: z.string().optional().describe("Selected size"),
      color: z.string().optional().describe("Selected color"),
      promo_code: z.string().optional().describe("Promo code (for apply_promo)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    switch (params.action) {
      case "create": {
        const cart = cartManager.create();
        return { content: [{ type: "text" as const, text: `Cart created. ID: ${cart.id}\nUse this ID for all subsequent cart operations.` }] };
      }
      case "add": {
        if (!params.cart_id || !params.product_id) {
          return { content: [{ type: "text" as const, text: "cart_id and product_id are required for add." }], isError: true };
        }
        const attrs: Record<string, string> = {};
        if (params.size) attrs.size = params.size;
        if (params.color) attrs.color = params.color;
        const result = cartManager.addItem(params.cart_id, params.product_id, params.quantity, attrs);
        if ("error" in result) return { content: [{ type: "text" as const, text: result.error }], isError: true };
        return { content: [{ type: "text" as const, text: formatCart(result) }] };
      }
      case "remove": {
        if (!params.cart_id || !params.product_id) {
          return { content: [{ type: "text" as const, text: "cart_id and product_id required." }], isError: true };
        }
        const result = cartManager.removeItem(params.cart_id, params.product_id);
        if ("error" in result) return { content: [{ type: "text" as const, text: result.error }], isError: true };
        return { content: [{ type: "text" as const, text: formatCart(result) }] };
      }
      case "view": {
        if (!params.cart_id) return { content: [{ type: "text" as const, text: "cart_id required." }], isError: true };
        const cart = cartManager.get(params.cart_id);
        if (!cart) return { content: [{ type: "text" as const, text: "Cart not found." }], isError: true };
        return { content: [{ type: "text" as const, text: formatCart(cart) }] };
      }
      case "apply_promo": {
        if (!params.cart_id || !params.promo_code) {
          return { content: [{ type: "text" as const, text: "cart_id and promo_code required." }], isError: true };
        }
        const result = cartManager.applyPromo(params.cart_id, params.promo_code);
        if ("error" in result) return { content: [{ type: "text" as const, text: result.error }], isError: true };
        return { content: [{ type: "text" as const, text: `Promo applied!\n\n${formatCart(result)}` }] };
      }
    }
  }
);

// ─── Tool: Check policies ────────────────────────────────────

server.registerTool(
  "check_policy",
  {
    title: "Check policies",
    description: `Check ${BRAND_NAME} business policies: returns eligibility, shipping costs, price matching, loyalty tier. Use before making recommendations.`,
    inputSchema: {
      policy: z.enum(["returns", "shipping", "price_match", "loyalty", "all"]).describe("Which policy"),
      purchase_date: z.string().optional().describe("Purchase date (for returns/price match, ISO format)"),
      item_category: z.string().optional().describe("Item category (for returns)"),
      subtotal: z.number().optional().describe("Cart subtotal (for shipping calculation)"),
      shipping_method: z.enum(["standard", "express"]).optional().describe("Shipping method"),
      total_spend: z.number().optional().describe("Customer total spend (for loyalty tier)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (params) => {
    let result = "";

    if (params.policy === "all" || params.policy === "returns") {
      if (params.purchase_date && params.item_category) {
        const check = policies.canReturn({
          category: params.item_category,
          purchaseDate: params.purchase_date,
          worn: false,
        });
        result += `**Return eligibility:** ${check.eligible ? "Yes" : "No"} — ${check.reason}\nDeadline: ${check.deadline}\n\n`;
      } else {
        result += policies.formatForAgent().split("\n\n")[0] + "\n\n";
      }
    }

    if (params.policy === "all" || params.policy === "shipping") {
      const ship = policies.calculateShipping(
        params.subtotal || 0,
        params.shipping_method || "standard"
      );
      result += `**Shipping:** $${ship.cost} (${ship.estimatedDays})${ship.freeShipping ? " — FREE!" : ""}\n\n`;
    }

    if (params.policy === "all" || params.policy === "loyalty") {
      if (params.total_spend !== undefined) {
        const loyalty = policies.getLoyaltyInfo(params.total_spend);
        result += `**Loyalty:** ${loyalty.tier} tier (${loyalty.multiplier}x points).\n`;
        result += `Points earned: ${loyalty.pointsEarned}.\n`;
        if (loyalty.nextTier) result += `$${loyalty.spendToNextTier} to ${loyalty.nextTier}.\n`;
        result += "\n";
      }
    }

    if (params.policy === "all") {
      result += policies.formatForAgent();
    }

    return { content: [{ type: "text" as const, text: result || "Specify a policy type and relevant parameters." }] };
  }
);

// ─── Tool: Agent negotiation ─────────────────────────────────

server.registerTool(
  "negotiate",
  {
    title: "Negotiate with agent",
    description: `Structured agent-to-agent negotiation. Send a shopping intent with constraints (budget, size, occasion, delivery date) and receive ranked product recommendations with alternatives and bundle offers.`,
    inputSchema: {
      intent_type: z.enum(["product_search", "price_inquiry", "availability_check", "bundle_request", "comparison"]).describe("What you're looking for"),
      query: z.string().describe("Natural language description of what you want"),
      budget_min: z.number().optional().describe("Minimum budget"),
      budget_max: z.number().optional().describe("Maximum budget"),
      size: z.array(z.string()).optional().describe("Acceptable sizes"),
      occasion: z.string().optional().describe("Occasion"),
      quantity: z.number().optional().describe("How many items"),
      delivery_by: z.string().optional().describe("Need it by this date"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (params) => {
    const intent: NegotiationIntent = {
      type: params.intent_type,
      query: params.query,
      constraints: {
        budget: (params.budget_min || params.budget_max) ? {
          min: params.budget_min,
          max: params.budget_max,
        } : undefined,
        size: params.size,
        occasion: params.occasion,
        quantity: params.quantity,
        deliveryBy: params.delivery_by,
      },
    };

    const response = negotiate(intent, catalog);

    let result = `**${response.message}**\n\n`;

    if (response.products.length > 0) {
      result += "**Recommendations:**\n\n";
      for (const p of response.products) {
        result += `- **${p.name}** — $${p.price} — ${p.availability.replace("_", " ")} (${p.id})\n`;
        result += `  ${p.agentDescription}\n\n`;
      }
    }

    if (response.alternatives.length > 0) {
      result += "**Alternatives (slightly above budget):**\n\n";
      for (const p of response.alternatives) {
        result += `- ${p.name} — $${p.price} (${p.id})\n`;
      }
      result += "\n";
    }

    if (response.bundleDiscount) {
      result += `**Bundle offer:** Buy ${response.bundleDiscount.items.length} items together and save $${response.bundleDiscount.savings}!\n`;
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Helpers ─────────────────────────────────────────────────

function formatCart(cart: import("./services/catalog.js").Cart): string {
  let result = `**Cart** (${cart.id})\n\n`;

  if (cart.items.length === 0) {
    result += "Empty cart.\n";
    return result;
  }

  for (const item of cart.items) {
    const product = catalog.get(item.productId);
    const name = product?.name || item.productId;
    const attrs = Object.entries(item.selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(", ");
    result += `- ${name}${attrs ? ` (${attrs})` : ""} × ${item.quantity} — $${(item.price * item.quantity).toFixed(2)}\n`;
  }

  result += `\nSubtotal: $${cart.subtotal.toFixed(2)}\n`;
  if (cart.discount > 0) result += `Discount${cart.promoCode ? ` (${cart.promoCode})` : ""}: -$${cart.discount.toFixed(2)}\n`;
  result += `Shipping: ${cart.shipping === 0 ? "FREE" : `$${cart.shipping.toFixed(2)}`}\n`;
  result += `Tax: $${cart.tax.toFixed(2)}\n`;
  result += `**Total: $${cart.total.toFixed(2)}**\n`;

  return result;
}

// ─── HTTP Server ─────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: `${BRAND_NAME}-commerce`, catalog: catalog.stats() });
});

app.get("/agent.json", (_req, res) => {
  res.json({
    name: BRAND_NAME,
    spec_version: "1.0",
    description: `${BRAND_NAME} agent commerce platform — search products, check policies, manage cart, and negotiate.`,
    capabilities: [
      { name: "search_products", description: "Search product catalog", type: "query" },
      { name: "get_product", description: "Get product details", type: "query" },
      { name: "manage_cart", description: "Cart operations", type: "action" },
      { name: "check_policy", description: "Check business policies", type: "query" },
      { name: "negotiate", description: "Agent-to-agent negotiation", type: "negotiation" },
    ],
    endpoints: { mcp: `http://localhost:${PORT}/mcp` },
    policies: { rate_limit: "100/minute", data_handling: "no_training_on_interactions" },
    brand_voice: { tone: "warm, knowledgeable, never pushy" },
  });
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  const stats = catalog.stats();
  console.error(`
  ╔═══════════════════════════════════════════════════╗
  ║   AgentWeb Commerce Platform                     ║
  ╚═══════════════════════════════════════════════════╝

  Brand:      ${BRAND_NAME}
  Products:   ${stats.totalProducts} (${stats.inStock} in stock)
  Categories: ${stats.categories}
  MCP:        http://localhost:${PORT}/mcp
  Health:     http://localhost:${PORT}/health
  agent.json: http://localhost:${PORT}/agent.json
  `);
});
