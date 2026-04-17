# Contributing to AgentWeb

Thanks for your interest in making the web agent-ready. Here's how to get involved.

## Ways to Contribute

### 1. Spec Feedback (Most Impactful)
The agent.json spec is designed to evolve with community input. The best contributions right now:
- **Real-world testing**: Try writing an agent.json for your own site or API. What fields are missing? What's confusing?
- **Industry examples**: We need agent.json examples for every industry — healthcare, finance, education, government, etc.
- **Edge cases**: What scenarios does the spec not handle well?

Open a [Discussion](https://github.com/agentweb/agentweb/discussions) with your feedback.

### 2. Code Contributions

**Good first issues:**
- Add new checks to the readiness scorer
- Write agent.json examples for different industries
- Improve error messages in the validator
- Add input parsers to the generator (new API formats)

**Setting up locally:**
```bash
git clone https://github.com/agentweb/agentweb.git
cd agentweb
npm install
npm run build
```

**Running tests:**
```bash
npm test
```

### 3. Integrations
Build plugins that generate or consume agent.json:
- CMS plugins (WordPress, Strapi, Contentful)
- E-commerce plugins (Shopify, WooCommerce)
- CI/CD integrations (GitHub Actions, GitLab CI)
- Framework middleware (Express, Next.js, FastAPI)

### 4. Documentation
- Improve existing docs
- Write tutorials and guides
- Translate docs to other languages

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Write tests for any new functionality
3. Ensure all tests pass (`npm test`)
4. Update documentation if needed
5. Open a PR with a clear description of what and why

## Spec Change Process

Changes to the agent.json spec follow a more deliberate process:

1. **Proposal**: Open a Discussion describing the change and why it's needed
2. **Feedback**: Community discussion (minimum 7 days)
3. **RFC**: If there's support, create a formal RFC in `docs/rfcs/`
4. **Implementation**: PR with schema changes, type updates, and validator updates
5. **Release**: Spec version bump following semver

## Code Style

- TypeScript for all packages
- Strict mode enabled
- No `any` types (use `unknown` + type guards)
- Tests with vitest
- Descriptive variable names over comments

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
