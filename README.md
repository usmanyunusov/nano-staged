# Nano Staged

Pipeliner for staged git files

- It 80 times smaller than `lint-staged`.

## Benchmarks

Running time for `index.js`

```diff
$ node benchmarks/running-time/index.js
  lint-staged 1.4783997449874877ms
+ nano-staged 1.2016788699626924ms
```

Running time for `index.js`, `index.css`, `bootstrap.css`

```diff
$ node benchmarks/running-time/index.js
  lint-staged 1.8991241788864135ms
+ nano-staged 1.6362823400497437ms
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
