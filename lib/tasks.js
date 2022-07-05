import * as p from 'path'

import { split_in_chunks, normalize } from './utils.js'
import { create_debug } from './debug.js'
import { globrex } from './glob.js'

const debug = create_debug('nano-staged:create-tasks')

export function create_tasks({ files_by_config, cwd_is_explicit, max_arg_length, cwd }) {
  const is_multiple = Object.keys(files_by_config).length > 1
  const matched_files = new Set()
  const config_tasks = []

  for (const [path, { config, files }] of Object.entries(files_by_config)) {
    const group_cwd = is_multiple && !cwd_is_explicit ? p.dirname(path) : cwd
    const chunks = [...split_in_chunks(files, max_arg_length)]
    const chunks_len = chunks.length

    for (const [index, files] of chunks.entries()) {
      const tasks = []

      for (const [pattern, commands] of Object.entries(config)) {
        const matches = globrex(pattern, { extended: true, globstar: pattern.includes('/') })
        const task_files = []

        for (let file of files) {
          file = normalize(p.relative(group_cwd, file))

          if (!pattern.startsWith('../') && (file.startsWith('..') || p.isAbsolute(file))) {
            continue
          }

          if (matches.test(file)) {
            file = normalize(p.resolve(group_cwd, file))
            matched_files.add(file)
            task_files.push(file)
          }
        }

        const task = { files: task_files, commands, pattern }
        debug('Generated task: \n%O', task)

        tasks.push(task)
      }

      config_tasks.push({
        chunks_len,
        tasks,
        index,
        files,
        path,
      })
    }
  }

  return { config_tasks, matched_files }
}
