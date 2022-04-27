import { nanoid } from 'nanoid'
import { tmpdir } from 'os'
import fs from 'fs-extra'
import path from 'path'

function create_temp() {
  const temp_dir = fs.realpathSync(tmpdir())
  const work_dir = path.join(temp_dir, `nano-staged-${nanoid()}`)

  fs.ensureDirSync(work_dir)

  return path.normalize(work_dir)
}

export class FilesystemTestRig {
  temp = create_temp()

  async ensure(dir) {
    await fs.ensureDir(dir)
  }

  async append(file, content, dir = this.temp) {
    const file_path = path.isAbsolute(file) ? file : path.join(dir, file)
    const file_dir = path.parse(file_path).dir

    await fs.ensureDir(file_dir)
    await fs.appendFile(file_path, content)
  }

  async write(file, content, dir = this.temp) {
    const file_path = path.isAbsolute(file) ? file : path.join(dir, file)
    const file_dir = path.parse(file_path).dir

    await fs.ensureDir(file_dir)
    await fs.writeFile(file_path, content)
  }

  async read(file, dir = this.temp) {
    const file_path = path.isAbsolute(file) ? file : path.join(dir, file)
    return await fs.readFile(file_path, { encoding: 'utf-8' })
  }

  async remove(file, dir = this.temp) {
    const file_path = path.isAbsolute(file) ? file : path.join(dir, file)
    await fs.remove(file_path)
  }

  async copy(file, new_file) {
    await fs.copy(file, new_file)
  }
}
