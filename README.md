# Web Radio

A small, static directory and player for browser-compatible live radio channels. The collection covers Greater China and a curated international selection spanning the United States, Canada, the United Kingdom, Ireland, France, Switzerland, Australia, and South Africa. Audio is never proxied or stored: stations play directly from their public stream provider.

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
