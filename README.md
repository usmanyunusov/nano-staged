# Nano Staged

A tool that lets you easily manage staged git files

- Only **single dependency** `picocolors`.
- It **80 times** smaller than `lint-staged`.

## Motivation

Run tests/formatters only files that will be committed

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
   npm install nano-staged --save-dev
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

## Configuration

#### `package.json` example:

```json
{
  "name": "MyApp",
  "version": "0.1.0",
  "nano-staged": {
    "*": "your-cmd"
  },
  "simple-git-hooks": {
    "pre-commit": "npx nano-staged"
  }
}
```

## Examples
