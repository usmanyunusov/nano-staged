/**
 * Function config that receives matched files and returns command(s)
 */
type FnConfiguration = (api: {
  /** Absolute file paths that match the glob pattern */
  filenames: string[]
  /** File type */
  type: 'staged' | 'unstaged' | 'diff'
}) => string | string[]

/**
 * Object config mapping glob patterns to commands
 */
type ObjConfiguration = {
  [glob: string]: string | string[] | FnConfiguration
}

/**
 * User configuration
 */
export type Configuration = ObjConfiguration | FnConfiguration

/**
 * Options for nano-staged
 */
export interface Options {
  /**
   * Stream to write output to
   * 
   * @default process.stderr
   */
  stream?: NodeJS.WriteStream

  /**
   * The working directory
   * 
   * @default process.cwd()
   */
  cwd?: string

  /**
   * Whether to allow empty git commits
   * 
   * @default false
   */
  allowEmpty?: boolean

  /**
   * Config file path or config object. 
   * If not provided, searches for config files in cwd.
   */
  config?: string | Configuration

  /**
   * Whether to process unstaged files instead of staged files
   * 
   * @default false
   */
  unstaged?: boolean

  /**
   * Process files changed between two git refs [ref1, ref2]
   */
  diff?: [string, string]

  /**
   * Whether to suppress output
   * 
   * @default false
   */
  quiet?: boolean
}

/**
 * Run commands for modified git files
 */
export default function nanoStaged(options?: Options): Promise<void>