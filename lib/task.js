function register_task(root, title, fn, renderer) {
  const index = root.children.push({
    parent: root,
    state: 'pending',
    children: [],
    skip: false,
    title,
  })

  const task = root.children[index - 1]

  return {
    task,
    async run() {
      try {
        task.state = 'loading'

        await fn({
          task: create_task(task, renderer),
          update(next) {
            for (let key in next) {
              task[key] = next[key]
            }
          },
        })

        if (task.state === 'loading') {
          task.state = 'success'
        }
      } catch (error) {
        throw error
      } finally {
        if (!renderer.isTTY) {
          renderer.render()
        }
      }
    },
  }
}

export function create_task(root, renderer) {
  const task = async (title, fn) => {
    const reg_task = register_task(root, title, fn, renderer)
    await reg_task.run()

    return {
      get state() {
        return reg_task.task.state
      },
    }
  }

  task.group = async (create_tasks) => {
    const tasks = await create_tasks((title, fn) => register_task(root, title, fn, renderer))

    for (const task of tasks) {
      await task.run()
    }
  }

  return task
}
