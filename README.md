# Nano Staged

Tiny tool to run commands only for staged git files. It help **speeding up the run tests, lint code**, etc...

- 📦 **Small**: [40kB](https://packagephobia.com/result?p=nano-staged) (174x+ lighter than **lint-staged**).
- 🥇 **Single dependency** ([`picocolors`](https://github.com/alexeyraspopov/picocolors)).

## Benchmarks

Benchmarks running time for 10 file:

```diff
$ node bench/running-time/index.js
- lint-staged 1.357 ms
+ nano-staged 0.928 ms
```

The space in node_modules including sub-dependencies:

```diff
$ node bench/size/index.js
Data from packagephobia.com
- lint-staged   6792 kB
+ nano-staged     40 kB
```

The performance results were generated on a MBP Late 2013, 2,3 GHz Intel Core i7 by running `npm run bench` in the library folder. See [bench/running-time/index.js](https://github.com/usmanyunusov/nano-staged/blob/master/bench/running-time/index.js)

## Usage

### Getting Started

1. Add `nano-staged` as a development dependency in the root of your project.

   ```terminal
   npm install nano-staged -D
   ```

2. Add the `nano-staged` section to your `package.json`. Fill it with [glob pattern](#cheatsheet-to-filtering-files) and the corresponding commands:

   For example:

   ```json
   "nano-staged": {
      "*.js": "prettier --write",
      "*.css": ["stylelint", "eslint --fix"]
   },
   ```

3. Now, run commands with Nano Staged:

   ```terminal
   ./node_modules/.bin/nano-staged
   ```

   > Nano Staged will filter out files which are in staging area, and run commands from the config for them.

### Pre-commit Hook

> You can use Nano Staged with a pre-commit tools to run it automatically after every commit.

#### Simple Git Hooks

1. Install `simple-git-hooks` as a dev dependency:

   ```terminal
   npm install simple-git-hooks --save-dev
   ```

2. Add the `simple-git-hooks` section to your `package.json` and fill in the `pre-commit`:

   For example:

   ```json
   "simple-git-hooks": {
      "pre-commit": "./node_modules/.bin/nano-staged"
   }
   ```

3. Run the CLI script to update the git hooks with the commands from the config

   ```terminal
   npx simple-git-hooks
   ```

4. To automatically have Git hooks enabled after install, edit `package.json`

   ```json
   "scripts": {
      "postinstall": "npx simple-git-hooks"
   }
   ```

#### Husky

1. Install `husky` as a dev dependency:

   ```terminal
   npm install husky --save-dev
   ```

2. Enable Git hooks

   ```terminal
   npx husky install
   ```

3. Add a command to a hook
   
   ```terminal
   npx husky add .husky/pre-commit "./node_modules/.bin/nano-staged"
   ```

4. To automatically have Git hooks enabled after install, edit `package.json`

   ```json
   "scripts": {
      "postinstall": "npx husky install"
   }
   ```

## Configuration

Starting from the current working directory, Nano Staged looks for the following possible sources:

<details>
   <summary><b><code>.nano-staged.json</code></b></summary>
   <br/>

```json
{
  "*": "your-cmd",
  "*.ext": ["your-cmd", "your-cmd"]
}
```

</details>

<details>
   <summary><b><code>nano-staged.json</code></b></summary>
   <br/>

```json
{
  "*": "your-cmd",
  "*.ext": ["your-cmd", "your-cmd"]
}
```

</details>

<details>
   <summary><b><code>package.json</code></b></summary>
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

## Cheatsheet to filtering files

| **paths**           | **\*** | **\*\*/\*** | **\*.css** | **\*\*/\*.css** | **\*\*/\*.{css,js}** | **\*\*/!(\*test).js** | **src/\*\*/\*.js** |
| ------------------- | ------ | ----------- | ---------- | --------------- | -------------------- | --------------------- | ------------------ |
| `style.css`         | ✅     | ✅          | ✅         | ✅              | ✅                   | ❌                    | ❌                 |
| `src/style.css`     | ✅     | ✅          | ✅         | ✅              | ✅                   | ❌                    | ❌                 |
| `src/css/style.css` | ✅     | ✅          | ✅         | ✅              | ✅                   | ❌                    | ❌                 |
| `src/css/style.css` | ✅     | ✅          | ✅         | ✅              | ✅                   | ❌                    | ❌                 |
| `src/index.js`      | ✅     | ✅          | ❌         | ❌              | ✅                   | ❌                    | ✅                 |
| `src/js/index.js`   | ✅     | ✅          | ❌         | ❌              | ✅                   | ❌                    | ✅                 |
| `index.js`          | ✅     | ✅          | ❌         | ❌              | ✅                   | ❌                    | ❌                 |
| `test/b.test.js`    | ✅     | ✅          | ❌         | ❌              | ✅                   | ✅                    | ❌                 |
| `test/a.test.js`    | ✅     | ✅          | ❌         | ❌              | ✅                   | ✅                    | ❌                 |

## Thanks

Special thanks to [lint-staged](https://github.com/okonet/lint-staged). Some codes was borrowed from it.
