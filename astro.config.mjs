import node from '@astrojs/node'
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  env: {
    schema: {
      TMDB_READ_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
})
