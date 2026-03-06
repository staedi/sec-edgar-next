# SEC EDGAR Explorer (Next.js version)

Interactive 10-K company relationship graph and topic cluster explorer.  
Built with **Next.js 14** (App Router, static export) + **TypeScript** + React SVG.

## Project structure

```
sec-edgar-next/
├── app/
│   ├── layout.tsx          # Root layout (metadata, html/body)
│   └── page.tsx            # Home route → renders Explorer
├── components/
│   └── Explorer.tsx        # Main app — fully typed client component
├── next.config.js          # Static export for GitHub Pages
├── tsconfig.json           # TypeScript config
└── .github/workflows/
    └── deploy.yml          # Auto-deploy on push to main
```

## Local development

```bash
bun install
bun dev           # → http://localhost:3000/sec-edgar-explorer
bun run type-check  # TypeScript check without building
```

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<you>/sec-edgar-next.git
git push -u origin main
```

Then: **GitHub repo → Settings → Pages → Source → GitHub Actions**

Live at: `https://<you>.github.io/sec-edgar-next/`

> If you rename the repo, update `basePath` and `assetPrefix` in `next.config.js`.

## Deploy to Vercel instead

1. Set `basePath` and `assetPrefix` to `''` in `next.config.js`
2. Remove `output: 'export'`
3. Import repo at [vercel.com](https://vercel.com) — Next.js auto-detected
