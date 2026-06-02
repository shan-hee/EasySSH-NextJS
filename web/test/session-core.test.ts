import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadSftpDirectory, SFTP_PARENT_ENTRY } from "../src/lib/session/sftp-directory"
import type { DirectoryListResponse, FileInfo } from "../src/lib/api/sftp"
import type { SftpDirectoryItemBase } from "../src/lib/session/sftp-directory"

describe("loadSftpDirectory", () => {
  it("returns converted files and keeps the raw response when parent injection is disabled", async () => {
    const response = createDirectoryResponse({
      path: "/srv/app",
      parent: "/srv",
    })

    const result = await loadSftpDirectory({
      serverId: "server-1",
      path: "/srv/app",
      convertFileInfo: convertFileInfo,
      api: {
        async listDirectory(serverId, path) {
          assert.equal(serverId, "server-1")
          assert.equal(path, "/srv/app")
          return response
        },
      },
    })

    assert.equal(result.path, "/srv/app")
    assert.equal(result.parent, "/srv")
    assert.deepEqual(result.files.map((file) => file.name), ["src", "README.md"])
    assert.deepEqual(result.raw, response)
  })

  it("prepends the default parent entry when requested", async () => {
    const response = createDirectoryResponse({
      path: "/srv/app",
      parent: "/srv",
    })

    const result = await loadSftpDirectory({
      serverId: "server-2",
      path: "/srv/app",
      convertFileInfo: convertFileInfo,
      withParentEntry: true,
      api: {
        async listDirectory() {
          return response
        },
      },
    })

    assert.equal(result.files.length, 3)
    assert.deepEqual(result.files[0], SFTP_PARENT_ENTRY)
    assert.deepEqual(result.files.slice(1).map((file) => file.name), ["src", "README.md"])
  })

  it("uses a custom parent entry when provided", async () => {
    const response = createDirectoryResponse({
      path: "/srv/app",
      parent: "/srv",
    })
    const customParent: SftpDirectoryItemBase = {
      ...SFTP_PARENT_ENTRY,
      name: ".. / custom",
      permissions: "drwx------",
    }

    const result = await loadSftpDirectory({
      serverId: "server-3",
      path: "/srv/app",
      convertFileInfo: convertFileInfo,
      withParentEntry: true,
      parentEntry: customParent,
      api: {
        async listDirectory() {
          return response
        },
      },
    })

    assert.deepEqual(result.files[0], customParent)
  })
})

function createDirectoryResponse(overrides: Partial<DirectoryListResponse> = {}): DirectoryListResponse {
  return {
    path: "/srv/app",
    parent: "/srv",
    files: [
      createFileInfo({ name: "src", is_dir: true, size: 0 }),
      createFileInfo({ name: "README.md", is_dir: false, size: 128 }),
    ],
    ...overrides,
  }
}

function createFileInfo(overrides: Partial<FileInfo>): FileInfo {
  return {
    name: overrides.name ?? "file",
    path: overrides.path ?? `/srv/app/${overrides.name ?? "file"}`,
    size: overrides.size ?? 0,
    mode: overrides.mode ?? 0o100644,
    mod_time: overrides.mod_time ?? "2026-06-02T00:00:00Z",
    is_dir: overrides.is_dir ?? false,
    is_link: overrides.is_link ?? false,
    link_target: overrides.link_target,
    permission: overrides.permission,
  }
}

function convertFileInfo(info: FileInfo): SftpDirectoryItemBase {
  return {
    name: info.name,
    type: info.is_dir ? "directory" : "file",
    size: info.is_dir ? "-" : `${info.size} B`,
    sizeBytes: info.size,
    modified: info.mod_time,
    permissions: info.permission ?? (info.is_dir ? "drwxr-xr-x" : "-rw-r--r--"),
  }
}
