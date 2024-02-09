# to-esm-imports

- Simple script for transforming relative file imports to ESM-conformant ones (i.e. link to actual file with `.js` extension)
- Works with TypeScript source files (`.ts` extension)
- Can be used to transform single file or entire directory (recursively).
- Will ignore dirs from local `.gitignore` (run this tool from project root).
- Used to transform https://github.com/hyperledger/cacti sources (where other solutions failed), **not tested on other repos** (feel free to file an issue if more cases must be handled).
- Tested on Linux only!

## Usage

```bash

# Show help
to-esm-imports -h

# Convert local repository
to-esm-imports .

# Convert single file
to-esm-imports ./src/foo/bar.ts

# Use different logLevel
to-esm-imports --logLevel warn .
```

## Build and install locally

```bash
npm install
npm run build
npm install -g .
# to-esm-imports CLI should be available
```