# @agentweb/commerce

**The Shopify for agent commerce.**

A platform for brands to publish structured catalogs, pricing, policies, and brand voice in formats AI agents can negotiate with.

## Quick Start

```bash
# Run with demo catalog (6 products)
npx agentweb-commerce

# Run with your own products
CATALOG_FILE=./products.json BRAND_NAME="My Store" npx agentweb-commerce
```

Your store is agent-ready at `http://localhost:3001/mcp`.

## MCP Tools

| Tool | What It Does |
|------|-------------|
| `search_products` | NL search with category, price, size, color, occasion filters |
| `get_product` | Full product details + related items |
| `manage_cart` | Create cart, add/remove items, apply promos, view totals |
| `check_policy` | Returns, shipping, price match, loyalty tier evaluation |
| `negotiate` | Structured agent-to-agent negotiation with budget constraints |

## Agent Negotiation Protocol

The `negotiate` tool enables structured multi-turn commerce:

```
Consumer agent: "Find a summer wedding dress, budget $200-400, size M"
    ↓
Commerce agent: Returns ranked options with availability + pricing
    ↓
Consumer agent: "What about in emerald? And do you have matching shoes?"
    ↓
Commerce agent: Filtered results + related products + bundle discount offer
    ↓
Consumer agent: "Add dress and shoes to cart, apply WELCOME10"
    ↓
Commerce agent: Cart with totals, shipping, tax, and promo applied
```

## Catalog Format

Products are JSON objects:

```json
{
  "id": "prod_001",
  "name": "Riviera Linen Blazer",
  "description": "Lightweight linen blazer",
  "agentDescription": "Best for summer events and outdoor weddings. Runs true to size.",
  "category": "women",
  "price": 185,
  "currency": "USD",
  "availability": "in_stock",
  "attributes": {
    "size": ["XS", "S", "M", "L", "XL"],
    "color": ["Navy", "Cream", "Sage"]
  },
  "occasions": ["wedding", "business_casual"],
  "sustainable": true
}
```

Note the `agentDescription` field — this is optimized for agent consumption, not SEO. Write it like a knowledgeable sales associate would describe the product.

## Policy Engine

Machine-readable business rules agents can evaluate:

- **Returns**: Check eligibility by category and purchase date
- **Shipping**: Calculate cost by subtotal and method
- **Price matching**: Verify eligibility within window
- **Loyalty**: Calculate tier, points, and progress to next tier

## Pricing (Hosted Version)

| Tier | Products | Transactions | Price |
|------|----------|-------------|-------|
| Free | 100 | 1,000/mo | $0 |
| Starter | 5,000 | 50,000/mo | $299/mo |
| Business | 50,000 | Unlimited | $799/mo + 0.5% |
| Enterprise | Unlimited | Unlimited | Custom |

Self-hosted is free and open source.

## License

MIT (self-hosted) — Hosted version is commercial.
