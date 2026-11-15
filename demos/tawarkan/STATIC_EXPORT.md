# Rebuild TawarKan Pages demo

From the `arthursetiawan/tawarkan` app repo:

```bash
STATIC_EXPORT=1 npm run build
# then replace this folder with the contents of `out/`
rsync -a --delete out/ path/to/arthursetiawan.github.io/demos/tawarkan/
```

`basePath` / `assetPrefix`: `/demos/tawarkan`
