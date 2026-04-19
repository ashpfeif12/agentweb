/**
 * Product Catalog Engine
 *
 * A structured product graph that agents can query via natural language.
 * Not flat listings — products have relationships, occasions, styling
 * rules, and inventory signals.
 *
 * Brands load their catalog here. Agents query it.
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  agentDescription: string;  // Optimized for agent consumption, not SEO
  category: string;
  subcategory?: string;
  price: number;
  currency: string;
  compareAtPrice?: number;   // Original price if on sale
  availability: "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "backorder";
  stockCount?: number;
  restockDate?: string;
  images: string[];
  url: string;
  brand?: string;
  tags: string[];
  attributes: Record<string, string | string[]>;  // size, color, material, etc.
  rating?: number;
  reviewCount?: number;
  sustainable?: boolean;
  relatedProducts?: string[];  // product IDs
  occasions?: string[];        // "wedding", "casual", "business"
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilter {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  availability?: Product["availability"][];
  tags?: string[];
  attributes?: Record<string, string | string[]>;
  sustainable?: boolean;
  occasion?: string;
  query?: string;  // Natural language search
}

export interface CartItem {
  productId: string;
  quantity: number;
  selectedAttributes: Record<string, string>;  // e.g., { size: "M", color: "Navy" }
  price: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  promoCode?: string;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  createdAt: number;
}

export interface OrderConfirmation {
  orderId: string;
  items: CartItem[];
  total: number;
  currency: string;
  shippingAddress: Record<string, string>;
  estimatedDelivery: string;
  trackingUrl?: string;
  returnDeadline: string;
}

// ─── Catalog Store ───────────────────────────────────────────

export class CatalogStore {
  private products = new Map<string, Product>();
  private categories = new Set<string>();
  private tags = new Set<string>();

  load(products: Product[]): void {
    for (const p of products) {
      this.products.set(p.id, p);
      this.categories.add(p.category);
      for (const tag of p.tags) this.tags.add(tag);
    }
  }

  get(id: string): Product | undefined {
    return this.products.get(id);
  }

  search(filter: ProductFilter): { products: Product[]; total: number } {
    let results = [...this.products.values()];

    // Natural language query match
    if (filter.query) {
      const q = filter.query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.agentDescription.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.occasions && p.occasions.some(o => o.toLowerCase().includes(q)))
      );
    }

    // Category filter
    if (filter.category) {
      results = results.filter(p =>
        p.category.toLowerCase() === filter.category!.toLowerCase()
      );
    }

    // Subcategory
    if (filter.subcategory) {
      results = results.filter(p =>
        p.subcategory?.toLowerCase() === filter.subcategory!.toLowerCase()
      );
    }

    // Price range
    if (filter.minPrice !== undefined) {
      results = results.filter(p => p.price >= filter.minPrice!);
    }
    if (filter.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filter.maxPrice!);
    }

    // Availability
    if (filter.availability && filter.availability.length > 0) {
      results = results.filter(p => filter.availability!.includes(p.availability));
    }

    // Tags
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(p =>
        filter.tags!.some(t => p.tags.includes(t))
      );
    }

    // Attributes (e.g., size, color)
    if (filter.attributes) {
      for (const [key, value] of Object.entries(filter.attributes)) {
        const values = Array.isArray(value) ? value : [value];
        results = results.filter(p => {
          const attr = p.attributes[key];
          if (!attr) return false;
          const attrValues = Array.isArray(attr) ? attr : [attr];
          return values.some(v => attrValues.includes(v));
        });
      }
    }

    // Sustainable
    if (filter.sustainable !== undefined) {
      results = results.filter(p => p.sustainable === filter.sustainable);
    }

    // Occasion
    if (filter.occasion) {
      results = results.filter(p =>
        p.occasions?.some(o => o.toLowerCase().includes(filter.occasion!.toLowerCase()))
      );
    }

    const total = results.length;

    // Sort by relevance (if query) or newest
    if (filter.query) {
      const q = filter.query.toLowerCase();
      results.sort((a, b) => {
        const aName = a.name.toLowerCase().includes(q) ? 2 : 0;
        const bName = b.name.toLowerCase().includes(q) ? 2 : 0;
        const aTag = a.tags.some(t => t.toLowerCase().includes(q)) ? 1 : 0;
        const bTag = b.tags.some(t => t.toLowerCase().includes(q)) ? 1 : 0;
        return (bName + bTag) - (aName + aTag);
      });
    }

    return { products: results, total };
  }

  getCategories(): string[] {
    return [...this.categories].sort();
  }

  getTags(): string[] {
    return [...this.tags].sort();
  }

  getRelated(productId: string, limit = 5): Product[] {
    const product = this.products.get(productId);
    if (!product) return [];

    // Find related by explicit relations, then by category + tags
    const related: Product[] = [];

    if (product.relatedProducts) {
      for (const id of product.relatedProducts) {
        const p = this.products.get(id);
        if (p) related.push(p);
      }
    }

    if (related.length < limit) {
      const sameCat = [...this.products.values()]
        .filter(p => p.id !== productId && p.category === product.category)
        .slice(0, limit - related.length);
      related.push(...sameCat);
    }

    return related.slice(0, limit);
  }

  stats(): { totalProducts: number; categories: number; inStock: number; outOfStock: number } {
    const all = [...this.products.values()];
    return {
      totalProducts: all.length,
      categories: this.categories.size,
      inStock: all.filter(p => p.availability === "in_stock" || p.availability === "low_stock").length,
      outOfStock: all.filter(p => p.availability === "out_of_stock").length,
    };
  }
}

// ─── Cart Manager ────────────────────────────────────────────

export class CartManager {
  private carts = new Map<string, Cart>();
  private catalog: CatalogStore;

  constructor(catalog: CatalogStore) {
    this.catalog = catalog;
  }

  create(): Cart {
    const cart: Cart = {
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      items: [],
      subtotal: 0,
      currency: "USD",
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      createdAt: Date.now(),
    };
    this.carts.set(cart.id, cart);
    return cart;
  }

  get(cartId: string): Cart | undefined {
    return this.carts.get(cartId);
  }

  addItem(cartId: string, productId: string, quantity: number, attributes: Record<string, string>): Cart | { error: string } {
    const cart = this.carts.get(cartId);
    if (!cart) return { error: "Cart not found" };

    const product = this.catalog.get(productId);
    if (!product) return { error: `Product ${productId} not found` };
    if (product.availability === "out_of_stock") return { error: `${product.name} is out of stock` };

    // Check if already in cart
    const existing = cart.items.find(i => i.productId === productId &&
      JSON.stringify(i.selectedAttributes) === JSON.stringify(attributes));

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        selectedAttributes: attributes,
        price: product.price,
      });
    }

    this.recalculate(cart);
    return cart;
  }

  removeItem(cartId: string, productId: string): Cart | { error: string } {
    const cart = this.carts.get(cartId);
    if (!cart) return { error: "Cart not found" };

    cart.items = cart.items.filter(i => i.productId !== productId);
    this.recalculate(cart);
    return cart;
  }

  applyPromo(cartId: string, code: string): Cart | { error: string } {
    const cart = this.carts.get(cartId);
    if (!cart) return { error: "Cart not found" };

    // Simple promo engine — in production this would check against a promo database
    const promos: Record<string, number> = {
      "WELCOME10": 0.10,
      "SAVE20": 0.20,
      "AGENT15": 0.15,
    };

    const discount = promos[code.toUpperCase()];
    if (!discount) return { error: `Invalid promo code: ${code}` };

    cart.promoCode = code.toUpperCase();
    cart.discount = Math.round(cart.subtotal * discount * 100) / 100;
    this.recalculate(cart);
    return cart;
  }

  private recalculate(cart: Cart): void {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cart.subtotal = Math.round(cart.subtotal * 100) / 100;

    // Recalculate discount if promo exists
    if (cart.promoCode) {
      const promos: Record<string, number> = { "WELCOME10": 0.10, "SAVE20": 0.20, "AGENT15": 0.15 };
      const rate = promos[cart.promoCode] || 0;
      cart.discount = Math.round(cart.subtotal * rate * 100) / 100;
    }

    // Shipping: free over $75, otherwise $9.99
    cart.shipping = cart.subtotal >= 75 ? 0 : 9.99;

    // Tax: ~8.5%
    cart.tax = Math.round((cart.subtotal - cart.discount) * 0.085 * 100) / 100;

    cart.total = Math.round((cart.subtotal - cart.discount + cart.shipping + cart.tax) * 100) / 100;
  }
}

// ─── Negotiation Protocol ────────────────────────────────────

export interface NegotiationIntent {
  type: "product_search" | "price_inquiry" | "availability_check" | "bundle_request" | "comparison";
  query: string;
  constraints: {
    budget?: { min?: number; max?: number; currency?: string };
    size?: string[];
    occasion?: string;
    quantity?: number;
    deliveryBy?: string;
  };
}

export interface NegotiationResponse {
  intent: NegotiationIntent;
  products: Product[];
  alternatives: Product[];
  bundleDiscount?: { items: string[]; savings: number };
  message: string;
}

export function negotiate(
  intent: NegotiationIntent,
  catalog: CatalogStore
): NegotiationResponse {
  const filter: ProductFilter = {
    query: intent.query,
    minPrice: intent.constraints.budget?.min,
    maxPrice: intent.constraints.budget?.max,
    occasion: intent.constraints.occasion,
  };

  if (intent.constraints.size) {
    filter.attributes = { size: intent.constraints.size };
  }

  const { products } = catalog.search(filter);
  const top = products.slice(0, 5);

  // Find alternatives if budget is tight
  let alternatives: Product[] = [];
  if (intent.constraints.budget?.max && top.length < 3) {
    const relaxedFilter = { ...filter, maxPrice: (intent.constraints.budget.max || 0) * 1.25 };
    const relaxed = catalog.search(relaxedFilter);
    alternatives = relaxed.products
      .filter(p => !top.some(t => t.id === p.id))
      .slice(0, 3);
  }

  // Check for bundle opportunities
  let bundleDiscount: NegotiationResponse["bundleDiscount"];
  if (intent.type === "bundle_request" && top.length >= 2) {
    const bundleTotal = top.slice(0, 3).reduce((s, p) => s + p.price, 0);
    bundleDiscount = {
      items: top.slice(0, 3).map(p => p.id),
      savings: Math.round(bundleTotal * 0.10 * 100) / 100,  // 10% bundle discount
    };
  }

  let message = "";
  if (top.length === 0) {
    message = `No products match your criteria. ${alternatives.length > 0 ? "Here are some options slightly above your budget." : "Try broadening your search."}`;
  } else {
    message = `Found ${products.length} matching products. Here are the top ${top.length}.`;
    if (bundleDiscount) {
      message += ` Bundle these ${bundleDiscount.items.length} items and save $${bundleDiscount.savings}.`;
    }
  }

  return { intent, products: top, alternatives, bundleDiscount, message };
}
