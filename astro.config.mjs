import vercel from '@astrojs/vercel'
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  env: {
    schema: {
      TMDB_READ_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
})
