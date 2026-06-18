/* 打赏名单管理后台前端逻辑 */
(function () {
  'use strict'

  const TOKEN_KEY = 'donors_admin_token'
  const TOKEN = localStorage.getItem(TOKEN_KEY) || ''

  const $ = (id) => document.getElementById(id)
  const loginView = $('login-view')
  const mainView = $('main-view')
  const listEl = $('donor-list')
  const toast = $('toast')
  const dirtyTip = $('dirty-tip')

  /** @type {Array<{a: string, n: string[]}>} */
  let data = []
  let serverData = []
  let dirty = false

  // ─── 工具 ──────────────────────────────────────────
  function showToast(msg, type) {
    toast.textContent = msg
    toast.className = 'toast show' + (type ? ' ' + type : '')
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => {
      toast.className = 'toast'
    }, 2200)
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function setDirty(v) {
    dirty = v
    dirtyTip.textContent = v ? '● 有未保存的修改' : '未修改'
    dirtyTip.style.color = v ? 'var(--warn)' : 'var(--muted)'
  }

  // ─── 网络请求 ────────────────────────────────────
  async function api(url, options = {}) {
    const opts = Object.assign(
      { headers: { 'Content-Type': 'application/json' } },
      options
    )
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body)
    }
    if (TOKEN) opts.headers['X-Token'] = TOKEN
    const res = await fetch(url, opts)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.ok === false) {
      throw new Error(json.message || `请求失败 (${res.status})`)
    }
    return json
  }

  // ─── 登录态切换 ──────────────────────────────────
  function showLogin() {
    loginView.classList.remove('hidden')
    mainView.classList.add('hidden')
    $('login-token').focus()
  }

  function showMain() {
    loginView.classList.add('hidden')
    mainView.classList.remove('hidden')
  }

  async function tryAutoLogin() {
    if (!TOKEN) {
      showLogin()
      return
    }
    try {
      await api('/api/auth', { method: 'POST', body: { token: TOKEN } })
      showMain()
      await loadData()
    } catch (e) {
      showLogin()
    }
  }

  async function handleLogin() {
    const input = $('login-token')
    const value = input.value.trim()
    const errEl = $('login-error')
    errEl.textContent = ''
    if (!value) {
      errEl.textContent = '请输入 Token'
      return
    }
    try {
      await api('/api/auth', { method: 'POST', body: { token: value } })
      localStorage.setItem(TOKEN_KEY, value)
      // 重新读取 TOKEN（因为 const 不可变，这里用 location.reload 简化）
      location.reload()
    } catch (e) {
      errEl.textContent = e.message
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    location.reload()
  }

  // ─── 加载/渲染 ───────────────────────────────────
  async function loadData() {
    try {
      const [donorsJson, healthJson] = await Promise.all([
        api('/api/donors'),
        api('/api/health').catch(() => null),
      ])
      data = donorsJson.data || []
      serverData = JSON.parse(JSON.stringify(data))
      if (healthJson && healthJson.storage) {
        renderStorageTag(healthJson.storage)
      }
      render()
      showToast('已加载 ' + data.length + ' 个分组', 'success')
    } catch (e) {
      showToast('加载失败：' + e.message, 'error')
    }
  }

  function renderStorageTag(storage) {
    const el = $('storage-info')
    if (!el) return
    if (storage.mode === 'github') {
      el.textContent = `☁ ${storage.repo}@${storage.branch}`
      el.title = storage.path
    } else {
      el.textContent = '💾 本地文件'
      el.title = storage.path
    }
  }

  function render() {
    listEl.innerHTML = ''
    if (data.length === 0) {
      listEl.innerHTML =
        '<div class="muted" style="text-align:center; padding:40px 0;">暂无数据，点击「新增分组」开始添加</div>'
    }
    data.forEach((group, idx) => {
      listEl.appendChild(buildCard(group, idx))
    })
    updateStats()
  }

  function buildCard(group, idx) {
    const card = document.createElement('div')
    card.className = 'donor-card'
    const namesText = (group.n || []).join('\n')
    const count = (group.n || []).length
    card.innerHTML = `
      <div class="amount-wrap">
        <label>金额 (¥)</label>
        <input class="amount-input" type="number" step="0.01" min="0" value="${escapeHtml(group.a)}" data-idx="${idx}" data-field="a" />
        <div class="donor-subtotal">小计: ¥${subtotal(group)}</div>
      </div>
      <div class="names-wrap">
        <label>
          <span>支持者（每行一个）</span>
          <span class="name-count">${count} 人</span>
        </label>
        <textarea class="names-input" data-idx="${idx}" data-field="n" placeholder="每行一个名字">${escapeHtml(namesText)}</textarea>
      </div>
      <button class="del-btn" data-idx="${idx}" title="删除该分组">✕</button>
    `
    return card
  }

  function subtotal(group) {
    const a = parseFloat(group.a) || 0
    const c = (group.n || []).length
    return (a * c).toFixed(2)
  }

  function updateStats() {
    let amount = 0
    let count = 0
    data.forEach((g) => {
      const a = parseFloat(g.a) || 0
      const c = (g.n || []).length
      amount += a * c
      count += c
    })
    $('stat-amount').textContent = '¥' + amount.toFixed(2)
    $('stat-count').textContent = count
    $('stat-groups').textContent = data.length
  }

  // ─── 事件委托 ───────────────────────────────────
  listEl.addEventListener('input', (e) => {
    const t = e.target
    const idx = parseInt(t.dataset.idx, 10)
    const field = t.dataset.field
    if (isNaN(idx) || !field) return
    if (field === 'a') {
      data[idx].a = t.value
    } else if (field === 'n') {
      data[idx].n = t.value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      // 更新小计与人头数
      const card = t.closest('.donor-card')
      card.querySelector('.donor-subtotal').textContent =
        '小计: ¥' + subtotal(data[idx])
      card.querySelector('.name-count').textContent =
        data[idx].n.length + ' 人'
    }
    updateStats()
    setDirty(true)
  })

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.del-btn')
    if (!btn) return
    const idx = parseInt(btn.dataset.idx, 10)
    if (isNaN(idx)) return
    if (!confirm('确认删除该分组？')) return
    data.splice(idx, 1)
    setDirty(true)
    render()
  })

  $('add-btn').addEventListener('click', () => {
    data.push({ a: '0.00', n: [''] })
    setDirty(true)
    render()
    // 滚动到底部并聚焦金额
    requestAnimationFrame(() => {
      const cards = listEl.querySelectorAll('.amount-input')
      const last = cards[cards.length - 1]
      if (last) {
        last.focus()
        last.select()
        last.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  })

  $('reload-btn').addEventListener('click', async () => {
    if (dirty && !confirm('放弃当前修改并重新加载？')) return
    await loadData()
    setDirty(false)
  })

  $('reset-btn').addEventListener('click', () => {
    if (!dirty) return
    if (!confirm('放弃所有未保存的修改？')) return
    data = JSON.parse(JSON.stringify(serverData))
    setDirty(false)
    render()
  })

  $('save-btn').addEventListener('click', async () => {
    // 校验：去除空名字条目
    const cleaned = data
      .map((g) => ({
        a: g.a,
        n: (g.n || []).map((n) => String(n).trim()).filter((n) => n.length > 0),
      }))
      .filter((g) => g.n.length > 0 && parseFloat(g.a) >= 0)
    if (cleaned.length === 0) {
      showToast('没有有效数据可保存', 'error')
      return
    }
    try {
      await api('/api/donors', {
        method: 'PUT',
        body: { data: cleaned, token: TOKEN },
      })
      data = cleaned
      serverData = JSON.parse(JSON.stringify(data))
      setDirty(false)
      render()
      showToast('保存成功！共 ' + cleaned.length + ' 个分组', 'success')
    } catch (e) {
      showToast('保存失败：' + e.message, 'error')
    }
  })

  $('login-btn').addEventListener('click', handleLogin)
  $('login-token').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
  $('logout-btn').addEventListener('click', logout)

  // 离开前提示
  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  })

  // 启动
  tryAutoLogin()
})()
