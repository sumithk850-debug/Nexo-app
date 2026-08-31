/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the production IntegrationsPanel untouched while extending its
  // existing content area with Wikipedia through the compatibility adapter.
  turbopack: {
    resolveAlias: {
      "@/components/IntegrationsPanel": "./components/IntegrationsPanelWithWikipedia.tsx",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@/components/IntegrationsPanel": "./components/IntegrationsPanelWithWikipedia.tsx",
    };
    return config;
  },
};

export default nextConfig;
