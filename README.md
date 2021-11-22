# Nano Staged

Tool to run commands only on git staged files, **speeding up the validation/formatting** processes. It is for working with **git hooks** tools like an [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) and [husky](https://github.com/typicode/husky).

- 📦 **Small**: 200x+ lighter than **lint-staged**.
- 🥇 **Single dependency** ([`picocolors`](https://github.com/alexeyraspopov/picocolors)).

## Benchmarks

The space in node_modules including sub-dependencies:

```diff
$ node benchmarks/size/index.js
Data from packagephobia.com
- lint-staged   6792 kB
+ nano-staged     32 kB
```

Benchmarks running time for 1 file:

```diff
$ node benchmarks/running-time/index.js
- lint-staged 1.279 ms
+ nano-staged 0.849 ms
```

Benchmarks running time for 3 files:

```diff
$ node benchmarks/running-time/index.js
- lint-staged 1.901 ms
+ nano-staged 1.470 ms
```

The performance results were generated on a MBP Late 2013, 2,3 GHz Intel Core i7 by running `npm run benchmark` in the library folder. See [benchmarks/running-time/index.js](https://github.com/usmanyunusov/nano-staged/blob/master/benchmarks/running-time/index.js)

## Usage

1. Install `nano-staged` as a dev dependency:

   ```terminal
   npm install --save-dev nano-staged
   ```

2. Add the `nano-staged` section to your `package.json`. Fill it with glob pattern and the corresponding commands.

   For example:

   ```json
   "nano-staged": {
     "*.js": "prettier --write",
     "*.css": ["stylelint", "eslint --fix"]
   },
   ```

3. Run `./node_modules/.bin/nano-staged` to run commands.

4. Add the `simple-git-hooks` section to your `package.json` and fill in the `pre-commit` for the `npx nano-staged`.

   For example:

   ```json
   "simple-git-hooks": {
     "pre-commit": "./node_modules/.bin/nano-staged"
   }
   ```

5. Run the CLI script to update the git hooks with the commands from the config.

   ```terminal
   npx simple-git-hooks
   ```

## Configuration

<details>
   <summary><b><code>package.json</code> example</b></summary>
   <br/>

```json
{
  "nano-staged": {
    "*": "your-cmd",
    "*.ext": ["your-cmd", "your-cmd"]
  }
}
```

</details>

<details>
   <summary><b><code>nano-staged.json</code> and <code>.nano-staged.json</code> example</b></summary>
   <br/>

```json
{
  "*": "your-cmd",
  "*.ext": ["your-cmd", "your-cmd"]
}
```

</details>

## Thanks

Special thanks to [lint-staged](https://github.com/okonet/lint-staged). Some codes was borrowed from it.
