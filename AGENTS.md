# Repository Instructions

## Code Style
- Avoid `useState` in `useRef`.
- Avoid `any`.

## Documentation
- For every code change, add or update documentation in `docs/documentation/`.
- Keep documentation grouped by category:
  - `api/`
  - `components/`
  - `lib/`
  - `integrations/`
- Prefer one markdown file per source file being documented.
- For each documented file, list the file path, its responsibility, and the functions it contains with a short description of what each function does.
- Keep entries short, structured, and current with the code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
