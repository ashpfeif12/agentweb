# AgentWeb

**Make the web agent-ready.**

AgentWeb is an open platform for bridging the browser-centric web and the emerging agent-driven web. It provides a spec, tools, and infrastructure so AI agents can discover, query, and transact with any website or service.

## We Scored the Top 10 Sites — They All Failed

| Rank | Site | Discovery | Structure | Actions | Policies | Total | Grade |
|------|------|-----------|-----------|---------|----------|-------|-------|
| 1 | openai.com | 8/25 | 20/25 | 12/25 | 8/25 | **48** | F |
| 2 | stripe.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 3 | github.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 4 | anthropic.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 5 | shopify.com | 5/25 | 20/25 | 10/25 | 8/25 | **43** | F |
| 6 | nike.com | 5/25 | 20/25 | 10/25 | 3/25 | **38** | F |
| 7 | amazon.com | 5/25 | 13/25 | 10/25 | 8/25 | **36** | F |
| 8 | netflix.com | 2/25 | 5/25 | 2/25 | 3/25 | **12** | F |

**Average: 40/100.** The semantic foundation exists (Schema.org, APIs), but zero sites tell agents what they can do, how to represent the brand, or when to escalate to humans.

## The Problem

The web was built for browsers. AI agents are the next consumer — but they can't discover what your site does, what actions are available, or how to interact with it. There's no robots.txt for agents.

## agent.json — The Spec

Drop an agent.json at your domain root. It tells agents what you do and how to interact. Four required fields. Two minutes to create.

```json
