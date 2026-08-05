# Web Radio

A small, static directory and player for browser-compatible live radio channels. The collection covers central, Beijing–Tianjin, Guangdong, the Yangtze River Delta, Hong Kong, Taiwan, Chinese-language stations in the United States, and a curated selection of established music stations from the United Kingdom, France, Switzerland, and elsewhere. Audio is never proxied or stored: stations play directly from their public stream provider.

## Local preview

Run any static file server in the repository root, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish

Push the repository to GitHub with `main` as the default branch. In **Settings → Pages**, choose **GitHub Actions** as the source. The included workflow publishes the files from the repository root.

## Station policy

- Prefer official broadcaster domains and CDNs.
- Never proxy, cache, record, or bypass access controls.
- A station without a verified stable browser-compatible stream links to its official listening page.
