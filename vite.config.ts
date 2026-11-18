import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin, type ResolvedConfig} from 'vite';
import {ORGANIZATION_CONFIG} from './src/config/organization.ts';
import {THEME_PRESET_MAP} from './src/config/themePresets.ts';

function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://patgram.pages.dev';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSchemaPhone(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed;
  if (/^01\d{9}$/.test(trimmed)) return `+88${trimmed}`;
  return trimmed;
}

function buildAutoSeoArtifacts() {
  const baseUrl = normalizeBaseUrl(ORGANIZATION_CONFIG.siteUrl);
  const verification = (ORGANIZATION_CONFIG.googleSiteVerification || '').trim();
  const orgNameBn = (ORGANIZATION_CONFIG.organizationNameBn || '').trim();
  const orgNameEn = (ORGANIZATION_CONFIG.organizationNameEn || '').trim();
  const shortNameBn = (ORGANIZATION_CONFIG.shortNameBn || orgNameBn).trim();
  const seoTitle = (ORGANIZATION_CONFIG.seoTitle || orgNameBn).trim();
  const seoDescription = (ORGANIZATION_CONFIG.seoDescription || ORGANIZATION_CONFIG.defaultArticles?.footerSummary || orgNameBn).trim();
  const seoKeywords = (ORGANIZATION_CONFIG.seoKeywords || orgNameBn).trim();
  const themeMeta = THEME_PRESET_MAP[ORGANIZATION_CONFIG.themePreset] || THEME_PRESET_MAP.emerald_gold;
  const themeColor = themeMeta?.themeColorMeta || '#14532d';
  const socialImageUrl = `${baseUrl}/pwa-512x512.png`;

  const telephones = [
    formatSchemaPhone(ORGANIZATION_CONFIG.hotline1),
    formatSchemaPhone(ORGANIZATION_CONFIG.hotline2),
  ].filter((p): p is string => Boolean(p));

  const founders = (
    (ORGANIZATION_CONFIG.defaultFounders || []) as Array<{
      nameBn?: string;
      designationBn?: string;
      isPublished?: boolean;
    }>
  )
    .filter((f) => f.isPublished !== false && f.nameBn?.trim())
    .map((f) => ({
      '@type': 'Person',
      name: f.nameBn!.trim(),
      ...(f.designationBn?.trim() ? {jobTitle: f.designationBn.trim()} : {}),
    }));

  const sameAs = [ORGANIZATION_CONFIG.facebookPageUrl, ORGANIZATION_CONFIG.facebookGroupUrl]
    .map((u) => (u || '').trim())
    .filter(Boolean);

  const schemaData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: orgNameBn,
    ...(orgNameEn ? {alternateName: orgNameEn} : {}),
    url: `${baseUrl}/`,
    logo: socialImageUrl,
    foundingDate: String(ORGANIZATION_CONFIG.establishedYear || new Date().getFullYear()),
    description: (ORGANIZATION_CONFIG.defaultArticles?.footerSummary || seoDescription).trim(),
    ...(ORGANIZATION_CONFIG.email?.trim() ? {email: ORGANIZATION_CONFIG.email.trim()} : {}),
    ...(telephones.length > 0 ? {telephone: telephones} : {}),
    ...(ORGANIZATION_CONFIG.officeAddress?.trim()
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: ORGANIZATION_CONFIG.officeAddress.trim(),
            addressCountry: 'BD',
          },
        }
      : {}),
    ...(founders.length > 0 ? {founder: founders} : {}),
    ...(sameAs.length > 0 ? {sameAs} : {}),
  };

  const jsonLd = JSON.stringify(schemaData, null, 6)
    .replace(/<\//g, '<\\/')
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');

  const seoHtmlLines = [
    '<!-- AUTO-SEO-START -->',
    ...(verification
      ? [`    <meta name="google-site-verification" content="${escapeHtml(verification)}" />`]
      : []),
    `    <title>${escapeHtml(seoTitle)}</title>`,
    `    <meta name="description" content="${escapeHtml(seoDescription)}" />`,
    `    <meta name="keywords" content="${escapeHtml(seoKeywords)}" />`,
    '    <meta name="robots" content="index, follow" />',
    `    <link rel="canonical" href="${escapeHtml(baseUrl)}/" />`,
    '',
    '    <!-- PWA Web App Manifest and Theme Color -->',
    '    <link rel="manifest" href="/manifest.json" />',
    `    <meta name="theme-color" content="${escapeHtml(themeColor)}" />`,
    '    <meta name="mobile-web-app-capable" content="yes" />',
    '    <meta name="apple-mobile-web-app-capable" content="yes" />',
    '    <meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    `    <meta name="apple-mobile-web-app-title" content="${escapeHtml(shortNameBn)}" />`,
    '    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '    <link rel="icon" type="image/svg+xml" href="/icon.svg" />',
    '    <link rel="shortcut icon" href="/favicon.ico" />',
    '',
    '    <!-- Open Graph & Social Cards -->',
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:url" content="${escapeHtml(baseUrl)}/" />`,
    `    <meta property="og:site_name" content="${escapeHtml(orgNameBn)}" />`,
    '    <meta property="og:locale" content="bn_BD" />',
    `    <meta property="og:title" content="${escapeHtml(seoTitle)}" />`,
    `    <meta property="og:description" content="${escapeHtml(seoDescription)}" />`,
    `    <meta property="og:image" content="${escapeHtml(socialImageUrl)}" />`,
    '',
    '    <!-- Twitter / X Card -->',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(seoDescription)}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />`,
    '',
    '    <!-- Schema.org Structured Data (JSON-LD) -->',
    '    <script type="application/ld+json">',
    jsonLd,
    '    </script>',
    '    <!-- AUTO-SEO-END -->',
  ].join('\n');

  const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`;

  const today = new Date().toISOString().slice(0, 10);
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${escapeXml(baseUrl)}/</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');

  const manifestJson =
    JSON.stringify(
      {
        id: '/',
        name: orgNameBn,
        short_name: shortNameBn,
        description: seoDescription,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: themeColor,
        categories: ['social', 'community', 'productivity'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      null,
      2
    ) + '\n';

  return {seoHtmlLines, robotsTxt, sitemapXml, manifestJson};
}

function autoSeoPlugin(): Plugin {
  let outDir = 'dist';

  return {
    name: 'auto-seo-generator',
    configResolved(config: ResolvedConfig) {
      outDir = path.resolve(config.root, config.build.outDir || 'dist');
    },
    transformIndexHtml(html: string) {
      const markerPattern = /<!-- AUTO-SEO-START -->[\s\S]*?<!-- AUTO-SEO-END -->/;
      if (!markerPattern.test(html)) {
        return html;
      }
      const {seoHtmlLines} = buildAutoSeoArtifacts();
      return html.replace(markerPattern, seoHtmlLines);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname === '/robots.txt') {
          const {robotsTxt} = buildAutoSeoArtifacts();
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(robotsTxt);
          return;
        }
        if (pathname === '/sitemap.xml') {
          const {sitemapXml} = buildAutoSeoArtifacts();
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.end(sitemapXml);
          return;
        }
        if (pathname === '/manifest.json') {
          const {manifestJson} = buildAutoSeoArtifacts();
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.end(manifestJson);
          return;
        }
        next();
      });
    },
    writeBundle() {
      const {robotsTxt, sitemapXml, manifestJson} = buildAutoSeoArtifacts();
      fs.mkdirSync(outDir, {recursive: true});
      fs.writeFileSync(path.resolve(outDir, 'robots.txt'), robotsTxt, 'utf8');
      fs.writeFileSync(path.resolve(outDir, 'sitemap.xml'), sitemapXml, 'utf8');
      fs.writeFileSync(path.resolve(outDir, 'manifest.json'), manifestJson, 'utf8');
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), autoSeoPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
