/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NEXO keeps the large production IntegrationsPanel untouched. This small
  // adapter extends the existing panel with Wikipedia while preserving all
  // GitHub, Vercel, and Supabase behavior.
  turbopack: {
    resolveAlias: {
      "@/components/IntegrationsPanel": "./components/IntegrationsPanelWithWikipedia.tsx",
    },
  },
};

export default nextConfig;
