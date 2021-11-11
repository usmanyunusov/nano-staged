# Nano Staged

A tiny pipeliner on git staged files.

- 📦 **Small**: 80x+ lighter than **lint-staged**.
- 🥇 **Single dependency** (Picocolors).

## Motivation

**Nano Staged** allows you to run commands only on git staged files, **speeding up** the validation/formatting processes. It is for working with git-hooks tools like an **simple-git-hooks**.

## Benchmarks

Running time for `index.js`

```diff
$ node benchmarks/running-time/index.js
  lint-staged 1.789 ms
+ nano-staged 1.235 ms
```

Running time for `index.js`, `index.css`, `bootstrap.css`

```diff
$ node benchmarks/running-time/index.js
  lint-staged 2.403 ms
+ nano-staged 1.815 ms
```

## Quickstart

1. Install `nano-staged` as a dev dependency:

   ```terminal
   npm i -D nano-staged
   ```

2. Add `nano-staged` to your `package.json`. Fill it with glob pattern and the corresponding commands.

   For example:

   ```json
   {
     "nano-staged": {
       "*.js": "prettier --write",
       "*.css": ["stylelint", "eslint --fix"]
     }
   }
   ```

3. Add `simple-git-hooks`
   ```json
   {
     "simple-git-hooks": {
       "pre-commit": "npx nano-staged"
     }
   }
   ```

## Configuration
## Examples
