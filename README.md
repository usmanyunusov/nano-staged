# Nano Staged

Pipeliner for staged git files

- It 80 times smaller than `lint-staged`.

## Benchmarks

Running time for `index.js`

```diff
$ node benchmarks/running-time/index.js
  lint-staged 1.870 ms
+ nano-staged 1.297 ms
```

Running time for `index.js`, `index.css`, `bootstrap.css`

```diff
$ node benchmarks/running-time/index.js
  lint-staged 2.416 ms
+ nano-staged 1.982 ms
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
