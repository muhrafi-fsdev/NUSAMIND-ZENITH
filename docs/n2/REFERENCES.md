# Sumber dokumentasi yang dipakai

- Next.js migration lint via Context7 `/vercel/next.js/v16.2.9`: [Next.js ESLint](https://nextjs.org/docs/app/api-reference/config/eslint).
- Patch keamanan Next: [pembaruan 14 Oktober 2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [advisory RCE Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36). Versi kandidat 16.4.2 diverifikasi melalui npm dan build lokal.
- SheetJS via Context7 `/websites/sheetjs`: [distribusi resmi Node](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Paket CDN 0.20.3 tercatat dengan integrity pada lockfile.
- Playwright via Context7 `/microsoft/playwright`: [HTTP credentials](https://playwright.dev/docs/test-use-options#http-credentials), [web server fixture](https://playwright.dev/docs/test-webserver).
- Advisory dependency aktual dan URL masing-masing ada pada `evidence/production-audit.txt`; jangan menafsirkan audit level high yang exit 0 sebagai nol advisory total.
