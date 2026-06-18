/**
 * donors.json 存储抽象
 * - 当设置了 GITHUB_TOKEN + GITHUB_REPO 时：通过 GitHub Contents API 读写（生产/Vercel）
 * - 否则：读写本地文件系统（本地开发用 Express 启动）
 */
import fs from 'node:fs'
import path from 'node:path'
import { Octokit } from '@octokit/rest'

const LOCAL_DONORS_FILE = path.resolve(
  process.cwd(),
  'src',
  'assets',
  'data',
  'donors.json'
)

function isGithubMode() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO)
}

function getGithubConfig() {
  const [owner, repo] = process.env.GITHUB_REPO.split('/')
  if (!owner || !repo) {
    throw new Error('GITHUB_REPO 格式应为 owner/repo')
  }
  return {
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH || 'main',
    filePath:
      process.env.GITHUB_FILE_PATH || 'src/assets/data/donors.json',
  }
}

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN })
}

// ── 读取 ─────────────────────────────────────
export async function readDonors() {
  if (isGithubMode()) {
    const cfg = getGithubConfig()
    const octokit = getOctokit()
    try {
      const { data } = await octokit.repos.getContent({
        owner: cfg.owner,
        repo: cfg.repo,
        path: cfg.filePath,
        ref: cfg.branch,
      })
      if (Array.isArray(data)) {
        // 目录场景（不该出现，但兜底）
        return []
      }
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      if (e.status === 404) return []
      throw e
    }
  } else {
    try {
      const raw = fs.readFileSync(LOCAL_DONORS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      if (e.code === 'ENOENT') return []
      throw e
    }
  }
}

// ── 写入 ─────────────────────────────────────
export async function writeDonors(list) {
  const content = JSON.stringify(list, null, 2) + '\n'
  if (isGithubMode()) {
    const cfg = getGithubConfig()
    const octokit = getOctokit()
    // 拉取 sha 用于更新
    let sha
    try {
      const { data } = await octokit.repos.getContent({
        owner: cfg.owner,
        repo: cfg.repo,
        path: cfg.filePath,
        ref: cfg.branch,
      })
      if (!Array.isArray(data)) sha = data.sha
    } catch (e) {
      if (e.status !== 404) throw e
    }
    await octokit.repos.createOrUpdateFileContents({
      owner: cfg.owner,
      repo: cfg.repo,
      path: cfg.filePath,
      branch: cfg.branch,
      message:
        process.env.COMMIT_MESSAGE ||
        'chore(donors): update donors list [skip ci]',
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha,
    })
    return { source: 'github', path: cfg.filePath }
  } else {
    fs.mkdirSync(path.dirname(LOCAL_DONORS_FILE), { recursive: true })
    fs.writeFileSync(LOCAL_DONORS_FILE, content, 'utf-8')
    return { source: 'local', path: LOCAL_DONORS_FILE }
  }
}

// ── 探活信息 ─────────────────────────────────
export function getStorageInfo() {
  if (isGithubMode()) {
    const cfg = getGithubConfig()
    return {
      mode: 'github',
      repo: process.env.GITHUB_REPO,
      branch: cfg.branch,
      path: cfg.filePath,
    }
  }
  return { mode: 'local', path: LOCAL_DONORS_FILE }
}
