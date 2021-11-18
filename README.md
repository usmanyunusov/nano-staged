# Nano Staged

Tool to run commands only on git staged files, **speeding up the validation/formatting** processes. It is for working with **git hooks** tools like an [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) and [husky](https://github.com/typicode/husky).

- 📦 **Small**: ?x+ lighter than **lint-staged**.
- 🥇 **Single dependency** (Picocolors).
- 🤝 **Without merge conflicts**

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

3. Run `npx nano-staged` to run commands the git staged files.

4. Add the `simple-git-hooks` section to your `package.json` and fill in the `pre-commit` for the `npx nano-staged`.

   For example:

   ```json
   "simple-git-hooks": {
     "pre-commit": "npx nano-staged"
   }
   ```

## Configuration

<details>
   <summary><b><code>.package.json</code> example</b></summary>
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

## Examples
