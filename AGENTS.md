# Activity Tracker

- Work on feature branches with Conventional Commits and pull requests. Keep descriptions about final behavior and validation.
- Node.js 24.12+, strict TypeScript throughout. Every function and callback has at most 20 lines and cognitive complexity at most 20. No suppressions or weakened rules.
- Dependencies: domain is independent; application uses domain; adapters implement application ports; main composes adapters. The Chrome collector only shares public transport contracts. No imports from Time & Games or another checkout.
- Typed models and DTOs cross modules. Validate outside data in adapters. JSON is limited to transport, persistence and backup boundaries.
- Run npm run verify before completing changes. Check browser behavior for extension UI and use isolated databases for tests.
- Never commit observations, local rules, tokens, user IDs, databases, logs or generated extension builds.
