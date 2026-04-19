/**
 * Site Proxy Service
 *
 * The core engine of the middleware. Takes a target site URL,
 * crawls it, extracts structured content, caches it, and serves
 * it to agents via MCP tools.
 *
 * This is the "Cloudflare for agents" — it sits in front of any
 * website and makes it agent-consumable without the site owner
 * changing anything.
 */

export interface ProxyConfig {
  /** Target site URL */
  origin: string;

  /** agent.json for the site (if exists) */
  agentJson?: Record<string, unknown>;

  /** Cache TTL in seconds */
  cacheTtlSeconds: number;

  /** Rate limit per agent per minute */
  rateLimitPerMinute: number;

  /** Brand voice enforcement rules */
  brandVoice?: {
    tone?: string;
    prohibited?: string[];
    preferredName?: string;
  };

  /** Human escalation triggers */
  escalationTriggers?: string[];
}

export interface CachedContent {
  url: string;
  title: string;
  description: string;
  content: string;
  structuredData: Record<string, unknown>[];
  links: Array<{ text: string; href: string }>;
  cachedAt: number;
  ttl: number;
}

export interface ProductData {
  id: string;
  name: string;
  description: string;
  price?: number;
  currency?: string;
  availability?: string;
  image?: string;
  url: string;
  category?: string;
  brand?: string;
  rating?: number;
  attributes: Record<string, string>;
}

export interface SearchResult {
  query: string;
  results: Array<{
    title: string;
    description: string;
    url: string;
    relevance: number;
  }>;
  totalResults: number;
}

// ─── Rate Limiter ────────────────────────────────────────────

export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private limit: number;

  constructor(limitPerMinute: number) {
    this.limit = limitPerMinute;
  }

  check(agentId: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const window = this.windows.get(agentId);

    if (!window || now > window.resetAt) {
      this.windows.set(agentId, { count: 1, resetAt: now + 60000 });
      return { allowed: true, remaining: this.limit - 1, resetIn: 60 };
    }

    if (window.count >= this.limit) {
      return { allowed: false, remaining: 0, resetIn: Math.ceil((window.resetAt - now) / 1000) };
    }

    window.count++;
    return { allowed: true, remaining: this.limit - window.count, resetIn: Math.ceil((window.resetAt - now) / 1000) };
  }
}

// ─── Content Cache ───────────────────────────────────────────

export class ContentCache {
  private cache = new Map<string, CachedContent>();
  private defaultTtl: number;

  constructor(defaultTtlSeconds: number) {
    this.defaultTtl = defaultTtlSeconds * 1000;
  }

  get(url: string): CachedContent | null {
    const entry = this.cache.get(url);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > entry.ttl) {
      this.cache.delete(url);
      return null;
    }
    return entry;
  }

  set(content: CachedContent): void {
    this.cache.set(content.url, {
      ...content,
      cachedAt: Date.now(),
      ttl: content.ttl || this.defaultTtl,
    });
  }

  invalidate(url: string): void {
    this.cache.delete(url);
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { entries: number; oldestAge: number } {
    let oldest = Date.now();
    for (const entry of this.cache.values()) {
      if (entry.cachedAt < oldest) oldest = entry.cachedAt;
    }
    return {
      entries: this.cache.size,
      oldestAge: this.cache.size > 0 ? Math.round((Date.now() - oldest) / 1000) : 0,
    };
  }
}

// ─── Content Extractor ───────────────────────────────────────

export function extractStructuredContent(html: string, url: string): CachedContent {
  const title = extractTag(html, "title") || url;
  const description = extractMeta(html, "description") || "";

  // Extract JSON-LD structured data
  const structuredData: Record<string, unknown>[] = [];
  const jsonLdMatches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
      try {
        const parsed = JSON.parse(content);
        structuredData.push(parsed);
      } catch { /* skip invalid */ }
    }
  }

  // Extract main content (strip nav, footer, scripts, styles)
  let mainContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Truncate to reasonable size for agent consumption
  if (mainContent.length > 5000) {
    mainContent = mainContent.substring(0, 5000) + "... [truncated]";
  }

  // Extract links
  const links: Array<{ text: string; href: string }> = [];
  const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    const href = m[1] || "";
    const text = (m[2] || "").replace(/<[^>]+>/g, "").trim();
    if (text && href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      links.push({ text: text.substring(0, 100), href });
    }
  }

  return {
    url,
    title,
    description,
    content: mainContent,
    structuredData,
    links: links.slice(0, 50),
    cachedAt: Date.now(),
    ttl: 300000, // 5 minutes default
  };
}

export function extractProducts(structuredData: Record<string, unknown>[]): ProductData[] {
  const products: ProductData[] = [];

  for (const item of structuredData) {
    const type = item["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
      const offers = item.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const offer = Array.isArray(offers) ? offers[0] : offers;

      products.push({
        id: (item.sku as string) || (item.productID as string) || String(products.length),
        name: (item.name as string) || "",
        description: (item.description as string) || "",
        price: offer ? Number(offer.price) || undefined : undefined,
        currency: offer ? (offer.priceCurrency as string) || "USD" : undefined,
        availability: offer ? (offer.availability as string)?.replace("https://schema.org/", "") : undefined,
        image: Array.isArray(item.image) ? item.image[0] as string : (item.image as string),
        url: (item.url as string) || "",
        category: (item.category as string),
        brand: typeof item.brand === "object" ? (item.brand as Record<string, unknown>).name as string : (item.brand as string),
        rating: item.aggregateRating ? Number((item.aggregateRating as Record<string, unknown>).ratingValue) : undefined,
        attributes: {},
      });
    }
  }

  return products;
}

// ─── Brand Voice Filter ──────────────────────────────────────

export function filterBrandVoice(
  content: string,
  brandVoice?: ProxyConfig["brandVoice"]
): { content: string; violations: string[] } {
  if (!brandVoice) return { content, violations: [] };

  const violations: string[] = [];
  let filtered = content;

  if (brandVoice.prohibited) {
    for (const term of brandVoice.prohibited) {
      const regex = new RegExp(term, "gi");
      if (regex.test(filtered)) {
        violations.push(`Content contained prohibited term: "${term}"`);
        filtered = filtered.replace(regex, "[redacted]");
      }
    }
  }

  return { content: filtered, violations };
}

// ─── Escalation Detector ─────────────────────────────────────

export function shouldEscalate(
  userQuery: string,
  triggers: string[]
): { escalate: boolean; reason?: string } {
  const lower = userQuery.toLowerCase();

  const triggerPatterns: Record<string, string[]> = {
    complaint: ["complaint", "unhappy", "disappointed", "terrible", "worst", "unacceptable", "demand refund"],
    legal_question: ["lawyer", "legal", "sue", "lawsuit", "attorney", "rights", "liable"],
    medical_emergency: ["emergency", "urgent care", "911", "ambulance", "overdose", "chest pain"],
    patient_distress: ["suicidal", "self-harm", "abuse", "violence"],
    fraud_suspected: ["fraud", "stolen", "unauthorized charge", "identity theft"],
    order_value_over_500: [], // This would be checked programmatically, not via text
    allergy_concern: ["allergy", "allergic", "anaphylaxis", "epipen"],
    large_party: ["large group", "party of 10", "party of 12", "banquet", "corporate event"],
  };

  for (const trigger of triggers) {
    const patterns = triggerPatterns[trigger];
    if (patterns) {
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          return { escalate: true, reason: `Trigger matched: ${trigger} (detected: "${pattern}")` };
        }
      }
    }
  }

  return { escalate: false };
}

// ─── Helpers ─────────────────────────────────────────────────

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1]!.replace(/<[^>]+>/g, "").trim() : null;
}

function extractMeta(html: string, name: string): string | null {
  const match = html.match(
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*?)["']`, "i")
  );
  if (match) return match[1] || null;
  const match2 = html.match(
    new RegExp(`<meta[^>]*content=["']([^"']*?)["'][^>]*name=["']${name}["']`, "i")
  );
  return match2 ? match2[1] || null : null;
}
