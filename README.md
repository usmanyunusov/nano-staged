<p align="center">
   <img src="https://usmanyunusov.github.io/nano-staged/img/logo.svg" height="96">
   <h3 align="center">Nano Staged</h3>
   <p align="center">Tiny tool to run commands for modified, staged, and committed git files.<br/> It help <b>speeding up the run tests, linters, scripts</b>, and more</p>
</p>

## Features

- 📦 **Small**: [41kB](https://packagephobia.com/result?p=nano-staged) (160x+ lighter than **lint-staged**).
- 🥇 **Single dependency** ([`picocolors`](https://github.com/alexeyraspopov/picocolors)).
- ☯️ **Support multiple file states like staged, unstaged, last-commit, changed etc**

## Benchmarks

Benchmarks running time for 10 file:

```diff
$ node bench/running-time/index.js
- lint-staged 1.394 ms
+ nano-staged 0.968 ms
```

The space in node_modules including sub-dependencies:

```diff
$ node bench/size/index.js
Data from packagephobia.com
- lint-staged   6688 kB
+ nano-staged     47 kB
```

The performance results were generated on a MBP Late 2013, 2,3 GHz Intel Core i7 by running `npm run bench` in the library folder. See [bench/running-time/index.js](https://github.com/usmanyunusov/nano-staged/blob/master/bench/running-time/index.js)

## Usage

### Getting Started

1. First, install `nano-staged`:

   ```terminal
   npm install --save-dev nano-staged
   ```

2. Add the `nano-staged` section and the commands to your `package.json`:

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

   > Nano Staged by default to run commands from the config for staged files.

### Pre-commit Hook

> You can use Nano Staged with a pre-commit tools to run it automatically after every commit.

<details>
   <summary><b>Simple Git Hooks</b></summary>

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

3. Run the CLI script to update the git hooks with the commands from the config:

   ```terminal
   npx simple-git-hooks
   ```

4. To automatically have Git hooks enabled after install, edit `package.json`:

   ```json
   "scripts": {
      "postinstall": "npx simple-git-hooks"
   }
   ```

   </details>

<details>
   <summary><b>Husky</b></summary>

1. Install `husky` as a dev dependency:

   ```terminal
   npm install husky --save-dev
   ```

2. Enable Git hooks:

   ```terminal
   npx husky install
   ```

3. Add a command to a hook:

   ```terminal
   npx husky add .husky/pre-commit "./node_modules/.bin/nano-staged"
   ```

4. To automatically have Git hooks enabled after install, edit `package.json`:

   ```json
   "scripts": {
      "postinstall": "npx husky install"
   }
   ```

</details>

## Configuration

Nano Staged supports multiple ways to define config.

1. `nano-staged` section in `package.json`:

   ```json
   "nano-staged": {
      "*": "your-cmd",
      "*.ext": ["your-cmd", "your-cmd"]
   }
   ```

2. or a separate `.nano-staged.json` or `nano-staged.json` config file:

   ```json
   {
     "*": "your-cmd",
     "*.ext": ["your-cmd", "your-cmd"]
   }
   ```

3. or a more flexible `.nano-staged.cjs` or `nano-staged.cjs` config file to CommonJS modules:

   ```js
   module.exports = {
     '*': 'your-cmd',
     '*.ext': ['your-cmd', 'your-cmd'],
   }
   ```

4. or a more flexible `.nano-staged.mjs` or `nano-staged.mjs` config file to ECMAScript modules:

   ```js
   export default {
     '*': 'your-cmd',
     '*.ext': ['your-cmd', 'your-cmd'],
   }
   ```

5. or a more flexible `.nano-staged.js` or `nano-staged.js` config file:

   ```js
   // package.json => "type": "module"
   export default {
     '*': 'your-cmd',
     '*.ext': ['your-cmd', 'your-cmd'],
   }

   // package.json => "type": "commonjs"
   module.exports = {
     '*': 'your-cmd',
     '*.ext': ['your-cmd', 'your-cmd'],
   }
   ```

### Priorited formats:

If there are multiple configuration files in the same directory, Nano Staged will only use one. The priority order is as follows:

1. `.nano-staged.js`
2. `nano-staged.js`
3. `.nano-staged.cjs`
4. `nano-staged.cjs`
5. `.nano-staged.mjs`
6. `nano-staged.mjs`
7. `.nano-staged.json`
8. `nano-staged.json`
9. `package.json`

### Config Function API:

JS config files may export export either a single function or an object:

```js
export default (api) => {
  const jsFiles = api.files.filter((file) => path.extname(file) === '.js')

  return [`eslint --fix ${jsFiles.join(' ')}`, `prettier --write ${jsFiles.join(' ')}`]
}
```

```js
export default {
  '*.js': (api) => `eslint --fix ${api.files.join(' ')}`,
}
```

The `api` object exposes:

`api.filenames` - working filenames

`api.type` - run type: `staged`, `unstaged`, `diff`

## Command Line Interface

#### `--config [<path>]` or `-c [<path>]`

Path to file that contains your configuration object. The path should be either absolute or relative to the directory that your process is running from.

#### `--unstaged` or `-u`

Run commands from the config for only git unstaged files. Nano Staged by default use only staged git files.

#### `--diff [<ref1> <ref2>]`

Run commands to changed files between the working tree and the index or a tree, to changed files between the index and a tree, to changed files between two trees, or to changed files between two index.

#### `--allow-empty`

Will allow creating an empty commit.

## Thanks

Special thanks to [lint-staged](https://github.com/okonet/lint-staged). Some codes was borrowed from it.

## Community

The Nano Staged community can be found on [GitHub Discussions](https://github.com/usmanyunusov/nano-staged/discussions), where you can ask questions, voice ideas, and share your projects.