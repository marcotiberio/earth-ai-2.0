// https://nuxt.com/docs/api/configuration/nuxt-config
import { apiEndpoint, repositoryName } from './slicemachine.config.json'

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/prismic'],

  prismic: {
    endpoint: apiEndpoint || repositoryName,
    // The Prismic preview toolbar (static.cdn.prismic.io/prismic.js) sets
    // third-party cookies and trips Lighthouse "Best Practices" / deprecated-API
    // audits. Drop it from production builds (what gets audited / served to
    // visitors) while keeping in-context Preview working in local dev.
    toolbar: process.env.NODE_ENV !== 'production',
  },

  // Base URL used to build absolute og:url / og:image links. Override per
  // environment with NUXT_PUBLIC_SITE_URL (e.g. the production domain).
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://earthaistatic.netlify.app/',
    },
  },

  devServer: { port: 3000 },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        // Static Open Graph / Twitter defaults; page-level tags below override
        // title/description/image/url per route via useSeoMeta.
        { property: 'og:site_name', content: 'Earth AI' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'en_US' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      ],
    },
  },

  compatibilityDate: '2025-01-01',
})