import { create_renderer } from './renderer.js'

let renderer

function register_task(root, title, fn, renderer_opts) {
  const index = root.children.push({
    parent: root,
    state: 'pending',
    children: [],
    skip: false,
    error: undefined,
    title,
  })

  const task = root.children[index - 1]

  return {
    task,
    async run() {
      try {
        task.state = 'loading'

        await fn({
          task: create_task(task, renderer_opts),
          update(next) {
            for (let key in next) {
              task[key] = next[key]
            }
          },
          set_error(err) {
            task.state = 'error'
            task.error = err
          },
        })

        if (task.state === 'loading') {
          task.state = 'success'
        }
      } catch (error) {
        throw error
      } finally {
        if (!renderer.is_tty) {
          renderer.render()
        }
      }
    },
  }
}

export function create_task(root, renderer_opts) {
  if (!renderer) {
    renderer = create_renderer(root, renderer_opts)
  }

  const task = {
    start() {
      renderer.start()
    },

    stop() {
      renderer.stop()
    },

    async run(title, fn) {
      const reg_task = register_task(root, title, fn, renderer_opts)
      await reg_task.run()

      return {
        get state() {
          return reg_task.task.state
        },
        get error() {
          return reg_task.task.error
        },
      }
    },

    async group(create_tasks) {
      const reg_tasks = await create_tasks({
        run: (title, fn) => register_task(root, title, fn, renderer_opts),
      })

      for (const reg_task of reg_tasks) {
        await reg_task.run()
      }
    },
  }

  return task
}
