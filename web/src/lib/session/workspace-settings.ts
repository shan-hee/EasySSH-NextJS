export const DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  ".pytest_cache",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "target",
  "vendor",
  ".cache",
  ".DS_Store",
  "thumbs.db",
]

export type WorkspaceDownloadExcludePatternSource = string | string[] | null | undefined

export function parseWorkspaceDownloadExcludePatterns(
  source: WorkspaceDownloadExcludePatternSource,
): string[] {
  if (source == null) {
    return [...DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS]
  }

  const patterns = Array.isArray(source)
    ? source
    : source.split(/\r?\n|,/)

  return patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
}
