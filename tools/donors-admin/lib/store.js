/**
 * donors.json 存储抽象
 * 优先级：Vercel KV → GitHub Contents → 本地文件
 *
 *  - Vercel KV：生产首选，由 Vercel KV 控制台创建数据库后自动注入环境变量
 *  - GitHub   ：兼容旧用法（通过 Contents API 读写仓库里的 donors.json）
 *  - 本地     ：本地开发，pnpm start 直接读写 src/assets/data/donors.json
 *
 * 额外：若同时设了 GITHUB_TOKEN/GITHUB_REPO 与 KV 模式，会在写 KV 的同时
 *       把内容推送到 GitHub（手环 app 那边的 donors.json 仍能保持同步）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { kv } from '@vercel/kv'
import { Octokit } from '@octokit/rest'

const LOCAL_DONORS_FILE = path.resolve(
  process.cwd(),
  'src',
  'assets',
  'data',
  'donors.json'
)

// Vercel KV 内部使用的 key
const KV_KEY = 'donors:data'
const KV_META_KEY = 'donors:meta'

// ── 模式检测 ─────────────────────────────────────
function detectMode() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return 'kv'
  }
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    return 'github'
  }
  return 'local'
}

// ── GitHub 工具 ──────────────────────────────────
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

async function writeToGithub(list, content) {
  const cfg = getGithubConfig()
  const octokit = getOctokit()
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
  return {
    repo: process.env.GITHUB_REPO,
    branch: cfg.branch,
    path: cfg.filePath,
  }
}

// ── 读取 ────────────────────────────────────────
export async function readDonors() {
  const mode = detectMode()
  if (mode === 'kv') {
    const data = await kv.get(KV_KEY)
    return Array.isArray(data) ? data : []
  }
  if (mode === 'github') {
    const cfg = getGithubConfig()
    const octokit = getOctokit()
    try {
      const { data } = await octokit.repos.getContent({
        owner: cfg.owner,
        repo: cfg.repo,
        path: cfg.filePath,
        ref: cfg.branch,
      })
      if (Array.isArray(data)) return []
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      if (e.status === 404) return []
      throw e
    }
  }
  // local
  try {
    const raw = fs.readFileSync(LOCAL_DONORS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}

// ── 写入 ────────────────────────────────────────
export async function writeDonors(list) {
  const mode = detectMode()
  const content = JSON.stringify(list, null, 2)

  if (mode === 'kv') {
    // 1) 主存储：Vercel KV
    await kv.set(KV_KEY, list)
    // 2) 顺手存一份元信息（更新时间、分组数），便于 /api/health 暴露
    await kv.set(KV_META_KEY, {
      updatedAt: new Date().toISOString(),
      count: list.length,
    })
    // 3) 可选：把同一份内容也推送到 GitHub（保持 donors.json 与手环 app 同步）
    let githubInfo = null
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      try {
        githubInfo = await writeToGithub(list, content)
      } catch (e) {
        // GitHub 失败不影响 KV 写入完成，仅记录
        console.error('GitHub 同步失败（KV 数据已成功写入）:', e.message)
        githubInfo = { error: e.message }
      }
    }
    return {
      source: 'kv',
      key: KV_KEY,
      count: list.length,
      githubSync: githubInfo,
    }
  }

  if (mode === 'github') {
    const info = await writeToGithub(list, content)
    return { source: 'github', ...info, count: list.length }
  }

  // local
  fs.mkdirSync(path.dirname(LOCAL_DONORS_FILE), { recursive: true })
  fs.writeFileSync(LOCAL_DONORS_FILE, content + '\n', 'utf-8')
  return { source: 'local', path: LOCAL_DONORS_FILE, count: list.length }
}

// ── 探活 / 存储信息 ──────────────────────────────
export function getStorageInfo() {
  const mode = detectMode()
  if (mode === 'kv') {
    return {
      mode: 'kv',
      key: KV_KEY,
      githubSync: Boolean(
        process.env.GITHUB_TOKEN && process.env.GITHUB_REPO
      ),
    }
  }
  if (mode === 'github') {
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
