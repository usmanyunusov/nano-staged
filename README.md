# Nano Staged

A tiny pipeliner on git staged files.

- 📦 **Small**: 80x+ lighter than **lint-staged**.
- 🥇 **Single dependency** (Picocolors).

## Motivation

**Nano Staged** allows you to run commands only on git staged files, **speeding up** the validation/formatting processes. It is for working with git-hooks tools like an **simple-git-hooks**.

## Benchmarks

```diff
$ node benchmarks/running-time/index.js
Running time for 1 files
- lint-staged 1.602 ms
+ nano-staged 1.219 ms
```

```diff
$ node benchmarks/running-time/index.js
Running time for 3 files
- lint-staged 2.277 ms
+ nano-staged 1.905 ms
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
