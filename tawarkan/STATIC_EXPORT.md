# Static export config (source of truth for this demo)

The live files under `/tawarkan/` were built from [arthursetiawan/tawarkan](https://github.com/arthursetiawan/tawarkan) with this `next.config.ts` (push to that repo was denied from the Pages checkout; apply there when permissions allow):

```ts
import type { NextConfig } from "next";

/** GitHub Pages serves this demo at https://arthursetiawan.github.io/tawarkan/ */
const repoBase = "/tawarkan";

const nextConfig: NextConfig = {
  output: "export",
  basePath: repoBase,
  assetPrefix: repoBase,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

Rebuild: `npm ci && npm run build`, then replace this directory with `out/`.
