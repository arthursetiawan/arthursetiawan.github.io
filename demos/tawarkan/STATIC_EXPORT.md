# Static export config used for this demo

```ts
import type { NextConfig } from "next";

const repoBase = "/demos/tawarkan";

const nextConfig: NextConfig = {
  output: "export",
  basePath: repoBase,
  assetPrefix: repoBase,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
```

Could not push this config to `arthursetiawan/tawarkan` from the Pages checkout (403). Apply there when permissions allow.
