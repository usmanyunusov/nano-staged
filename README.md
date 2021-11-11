# Nano Staged

Pipeliner for staged git files

- It 80 times smaller than `lint-staged`.

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

## Configuration

#### `package.json` example:

```json
{
  "nano-staged": {
    "*.js": "prettier --write",
    "*.css": "eslint --fix"
  }
}
```
