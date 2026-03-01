import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
    root: resolve(__dirname),
    resolve: {
        alias: {
            '@engine': resolve(__dirname, '../src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        open: true,
    },
});
//# sourceMappingURL=vite.config.js.map