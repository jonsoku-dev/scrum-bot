import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: 'http://localhost:8000/api-json',
    output: {
      mode: 'tags-split',
      target: 'app/lib/api/generated.ts',
      schemas: 'app/lib/api/model',
      client: 'react-query',
      prettier: true,
      override: {
        mutator: {
          path: 'app/lib/api/axios.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
