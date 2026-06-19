/* 打赏名单管理后台前端逻辑 - 增强版 */
(function () {
  'use strict'

  // ─── 常量 ──────────────────────────────────────────
  const TOKEN_KEY = 'donors_admin_token'
  const TOKEN = localStorage.getItem(TOKEN_KEY) || ''

  // ─── DOM 引用 ───────────────────────────────────────
  const $ = (id) => document.getElementById(id)
  const loginView = $('login-view')
  const mainView = $('main-view')
  const listEl = $('donor-list')
  const toastEl = $('toast')
  const dirtyTipEl = $('dirty-tip')
  const previewSection = $('preview-section')
  const previewBody = $('preview-body')
  const previewCount = $('preview-count')

  // ─── 状态 ───────────────────────────────────────────
  /** @type {Array<{a:string,n:string[]}>} */
  let data = []
  let serverData = []
  let dirty = false
  let searchKeyword = ''
  let sortMode = 'desc' // desc|asc|countDesc|countAsc|original
  let previewVisible = false
  let healthMeta = null

  // ─── 工具函数 ────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function formatAmount(v) {
    const n = parseFloat(v) || 0
    return '¥' + n.toFixed(2)
  }

  function showToast(msg, type) {
    toastEl.textContent = msg
    toastEl.className = 'toast show' + (type ? ' ' + type : '')
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => {
      toastEl.className = 'toast'
    }, 2400)
  }

  function setDirty(v) {
    dirty = v
    if (v) {
      dirtyTipEl.textContent = '● 有未保存的修改'
      dirtyTipEl.classList.add('is-dirty')
    } else {
      dirtyTipEl.textContent = '● 已保存'
      dirtyTipEl.classList.remove('is-dirty')
    }
  }

  function updateSaveBtn() {
    const btn = $('save-btn')
    if (!btn) return
    btn.disabled = false // 这里不做过多限制，用户可随时尝试
  }

  // 数据合法性校验（单条 group）
  function validateGroup(group) {
    const warnings = []
    const a = parseFloat(group.a)
    if (isNaN(a) || a < 0) {
      warnings.push('金额必须是 ≥ 0 的数字')
    }
    if (a >= 0 && a < 1) {
      warnings.push('金额 < ¥1.00，保存后在手表端不会显示')
    }
    const names = (group.n || []).filter((x) => String(x).trim().length > 0)
    if (names.length === 0 && a > 0) {
      warnings.push('金额 > 0 但名单为空')
    }
    return warnings
  }

  // ─── 网络请求 ───────────────────────────────────────
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
      throw new Error(json.message || '请求失败 (' + res.status + ')')
    }
    return json
  }

  // ─── 视图切换 ───────────────────────────────────────
  function showLogin() {
    loginView.classList.remove('hidden')
    mainView.classList.add('hidden')
    const tokenInput = $('login-token')
    if (tokenInput) tokenInput.focus()
  }

  function showMain() {
    loginView.classList.add('hidden')
    mainView.classList.remove('hidden')
  }

  // ─── 登录逻辑 ───────────────────────────────────────
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
      location.reload()
    } catch (e) {
      errEl.textContent = e.message
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    location.reload()
  }

  // ─── 数据加载 ───────────────────────────────────────
  async function loadData() {
    try {
      const [donorsJson, healthJson] = await Promise.all([
        api('/api/donors?all=1'),
        api('/api/health').catch(() => null),
      ])
      data = donorsJson.data || []
      serverData = JSON.parse(JSON.stringify(data))
      if (healthJson && healthJson.meta) {
        healthMeta = healthJson.meta
        renderUpdateInfo()
      }
      if (healthJson && healthJson.storage) {
        renderStorageTag(healthJson.storage)
      }
      render()
      setDirty(false)
      showToast(
        '已加载 ' + data.length + ' 个分组',
        'success'
      )
    } catch (e) {
      showToast('加载失败：' + e.message, 'error')
    }
  }

  function renderStorageTag(storage) {
    const el = $('storage-info')
    if (!el) return
    if (storage.mode === 'kv') {
      el.textContent = '☁ KV'
      el.title = storage.key || ''
    } else if (storage.mode === 'github') {
      el.textContent = '☁ GitHub'
      el.title = (storage.repo || '') + (storage.branch ? '@' + storage.branch : '')
    } else {
      el.textContent = '💾 本地文件'
      el.title = storage.path || ''
    }
  }

  function renderUpdateInfo() {
    const el = $('update-info')
    if (!el || !healthMeta) return
    if (healthMeta.updatedAt) {
      try {
        const d = new Date(healthMeta.updatedAt)
        if (!isNaN(d.getTime())) {
          el.textContent =
            '最后更新 ' +
            d.getFullYear() +
            '-' +
            String(d.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(d.getDate()).padStart(2, '0') +
            ' ' +
            String(d.getHours()).padStart(2, '0') +
            ':' +
            String(d.getMinutes()).padStart(2, '0')
          return
        }
      } catch (e) {
        // ignore
      }
    }
    el.textContent = '未同步'
  }

  // ─── 排序 & 筛选 ───────────────────────────────────
  function getVisibleData() {
    let list = data
    // 搜索
    const kw = searchKeyword.trim().toLowerCase()
    if (kw) {
      list = list.filter((g) => {
        if (String(g.a || '').toLowerCase().includes(kw)) return true
        return (g.n || []).some((x) => String(x).toLowerCase().includes(kw))
      })
    }
    // 排序
    const arr = list.slice()
    switch (sortMode) {
      case 'asc':
        arr.sort((a, b) => (parseFloat(a.a) || 0) - (parseFloat(b.a) || 0))
        break
      case 'desc':
        arr.sort((a, b) => (parseFloat(b.a) || 0) - (parseFloat(a.a) || 0))
        break
      case 'countAsc':
        arr.sort((a, b) => (a.n || []).length - (b.n || []).length)
        break
      case 'countDesc':
        arr.sort((a, b) => (b.n || []).length - (a.n || []).length)
        break
      case 'original':
      default:
        break
    }
    return { list: arr, total: data.length }
  }

  // ─── 主渲染 ─────────────────────────────────────────
  function render() {
    const { list } = getVisibleData()
    listEl.innerHTML = ''
    if (list.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'donor-list-empty'
      if (searchKeyword.trim()) {
        empty.innerHTML =
          '<span class="big-emoji">🔎</span>没有找到与“' +
          escapeHtml(searchKeyword) +
          '”匹配的内容'
      } else {
        empty.innerHTML =
          '<span class="big-emoji">📋</span>暂无数据，点击「新增分组」开始添加'
      }
      listEl.appendChild(empty)
    } else {
      // 因为 list 可能是过滤后的切片，需要把原 data 的 idx 映射回来
      const idxMap = new Map()
      data.forEach((g, idx) => {
        if (!idxMap.has(g)) idxMap.set(g, idx)
      })
      list.forEach((g) => {
        const originalIdx = data.indexOf(g)
        listEl.appendChild(buildCard(g, originalIdx))
      })
    }
    updateStats()
    renderPreview()
  }

  function buildCard(group, idx) {
    const card = document.createElement('div')
    card.className = 'donor-card'
    const namesText = (group.n || []).join('\n')
    const count = (group.n || []).length
    const a = parseFloat(group.a) || 0
    const total = a * count

    // 样式提示：非法 / 将被隐藏
    const warnings = validateGroup(group)
    if (warnings.length > 0) {
      if (a < 1) card.classList.add('is-hidden')
      if (isNaN(parseFloat(group.a)) || parseFloat(group.a) < 0) {
        card.classList.add('is-invalid')
      }
    }

    const hintParts = []
    hintParts.push(
      '<span class="chip total">小计 ' + formatAmount(total) + '</span>'
    )
    if (a > 0 && a < 1) {
      hintParts.push('<span class="chip warn">金额 &lt; ¥1.00，手表端不显示</span>')
    }
    if (isNaN(a)) {
      hintParts.push('<span class="chip warn">金额非法</span>')
    }

    card.innerHTML =
      '<div class="amount-wrap">' +
      '<label>金额 (¥)</label>' +
      '<input class="amount-input" type="number" inputmode="decimal" step="0.01" min="0" value="' +
      escapeHtml(group.a) +
      '" data-idx="' +
      idx +
      '" data-field="a" />' +
      '<div class="donor-subtotal">' +
      hintParts.join(' ') +
      '</div>' +
      '</div>' +
      '<div class="names-wrap">' +
      '<label>' +
      '<span>支持者（每行一个）</span>' +
      '<span class="name-count">' +
      count +
      ' 人</span>' +
      '</label>' +
      '<textarea class="names-input" data-idx="' +
      idx +
      '" data-field="n" rows="' +
      Math.max(2, Math.min(count, 8)) +
      '" placeholder="每行一个名字">' +
      escapeHtml(namesText) +
      '</textarea>' +
      '</div>' +
      '<button class="del-btn" data-idx="' +
      idx +
      '" title="删除该分组">✕</button>'
    return card
  }

  // ─── 统计 ───────────────────────────────────────────
  function updateStats() {
    let amount = 0
    let count = 0
    let hiddenCount = 0
    let maxAmount = 0
    data.forEach((g) => {
      const a = parseFloat(g.a) || 0
      const c = (g.n || []).length
      amount += a * c
      count += c
      if (a > 0 && a < 1) hiddenCount += c
      if (a > maxAmount) maxAmount = a
    })
    $('stat-amount').textContent = '¥' + amount.toFixed(2)
    $('stat-amount-hint').textContent = '共 ' + count + ' 人'
    $('stat-count').textContent = count
    $('stat-avg').textContent =
      '人均 ¥' + (count > 0 ? (amount / count).toFixed(2) : '0.00')
    $('stat-groups').textContent = data.length
    $('stat-top').textContent = '最高 ¥' + maxAmount.toFixed(2)
    $('stat-hidden').textContent = hiddenCount
  }

  // ─── 手表端预览 ─────────────────────────────────────
  function renderPreview() {
    if (!previewVisible) {
      previewSection.classList.add('hidden')
      return
    }
    previewSection.classList.remove('hidden')
    // 过滤 & 按金额降序（模拟手表端显示逻辑）
    const forWatch = data
      .filter((g) => {
        const a = parseFloat(g.a) || 0
        return a >= 1 && (g.n || []).length > 0
      })
      .sort((a, b) => (parseFloat(b.a) || 0) - (parseFloat(a.a) || 0))

    previewBody.innerHTML = ''
    if (forWatch.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'preview-empty'
      empty.textContent = '（暂无 ≥ ¥1.00 的数据）'
      previewBody.appendChild(empty)
    } else {
      forWatch.forEach((g) => {
        const row = document.createElement('div')
        row.className = 'preview-row'
        row.innerHTML =
          '<span class="p-amount">' +
          formatAmount(g.a) +
          '</span>' +
          '<span class="p-names">' +
          escapeHtml((g.n || []).join('、')) +
          '</span>'
        previewBody.appendChild(row)
      })
    }
    previewCount.textContent =
      '显示 ' + forWatch.length + ' 条 / 总计 ' + data.length + ' 条'
  }

  function togglePreview() {
    previewVisible = !previewVisible
    const btn = $('preview-btn')
    if (btn) {
      btn.style.color = previewVisible ? 'var(--primary)' : ''
      btn.style.borderColor = previewVisible ? 'var(--primary)' : ''
    }
    renderPreview()
  }

  // ─── 模态框（通用） ─────────────────────────────────
  function openModal(opts) {
    const title = opts.title || '提示'
    const bodyHtml = opts.body || ''
    const confirmText = opts.confirmText || '确定'
    const cancelText = opts.cancelText || '取消'
    const onConfirm = opts.onConfirm || function () {}
    const showCancel = opts.showCancel !== false

    $('modal-title').textContent = title
    $('modal-body').innerHTML = bodyHtml
    $('modal-confirm').textContent = confirmText
    $('modal-cancel').textContent = cancelText
    $('modal-cancel').style.display = showCancel ? '' : 'none'

    $('modal').classList.remove('hidden')

    // 绑定一次性确认/取消按钮
    const confirmBtn = $('modal-confirm')
    const cancelBtn = $('modal-cancel')
    const closeBtn = $('modal-close')
    const confirmHandler = function () {
      closeModal()
      onConfirm()
    }
    const cancelHandler = function () {
      closeModal()
    }
    confirmBtn.onclick = confirmHandler
    cancelBtn.onclick = cancelHandler
    closeBtn.onclick = cancelHandler

    // 聚焦到 modal 区域以便键盘
    $('modal').focus()
  }

  function closeModal() {
    $('modal').classList.add('hidden')
  }

  // ─── 事件委托：编辑 ─────────────────────────────────
  function bindCardEvents() {
    listEl.addEventListener('input', (e) => {
      const t = e.target
      if (!(t instanceof HTMLElement)) return
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
        const count = data[idx].n.length
        const countEl = card && card.querySelector('.name-count')
        if (countEl) countEl.textContent = count + ' 人'

        // 金额/小计/样式更新
        const amountInput = card && card.querySelector('.amount-input')
        const subtotalEl = card && card.querySelector('.donor-subtotal')
        const a = parseFloat(amountInput && amountInput.value) || 0
        if (subtotalEl) {
          const parts = []
          parts.push(
            '<span class="chip total">小计 ' + formatAmount(a * count) + '</span>'
          )
          if (a > 0 && a < 1) {
            parts.push(
              '<span class="chip warn">金额 &lt; ¥1.00，手表端不显示</span>'
            )
          }
          if (isNaN(parseFloat(amountInput.value))) {
            parts.push('<span class="chip warn">金额非法</span>')
          }
          subtotalEl.innerHTML = parts.join(' ')
        }
        // 卡片状态
        if (a > 0 && a < 1) card.classList.add('is-hidden')
        else card.classList.remove('is-hidden')
        if (isNaN(parseFloat(amountInput.value)) || parseFloat(amountInput.value) < 0)
          card.classList.add('is-invalid')
        else card.classList.remove('is-invalid')
        // 金额输入框样式
        if (amountInput) {
          if (isNaN(parseFloat(amountInput.value)) || parseFloat(amountInput.value) < 0)
            amountInput.classList.add('is-invalid')
          else amountInput.classList.remove('is-invalid')
        }
      }

      updateStats()
      renderPreview()
      setDirty(true)
    })

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.del-btn')
      if (!btn) return
      const idx = parseInt(btn.dataset.idx, 10)
      if (isNaN(idx)) return
      openModal({
        title: '确认删除？',
        body:
          '<p>即将删除该分组（金额 ' +
          escapeHtml(formatAmount(data[idx].a)) +
          '，' +
          (data[idx].n || []).length +
          ' 人）</p><p class="muted" style="margin-top:8px;">删除后点击「保存」才会真正写入。</p>',
        confirmText: '删除',
        onConfirm: function () {
          data.splice(idx, 1)
          setDirty(true)
          render()
          showToast('已删除 1 个分组，记得保存', 'warn')
        },
      })
    })
  }

  // ─── 工具栏按钮 ─────────────────────────────────────
  function bindToolbar() {
    $('add-btn').addEventListener('click', () => {
      data.push({ a: '1.00', n: [''] })
      setDirty(true)
      render()
      // 滚动到底部并聚焦金额
      requestAnimationFrame(() => {
        const cards = listEl.querySelectorAll('.donor-card')
        const last = cards[cards.length - 1]
        if (last) {
          const input = last.querySelector('.amount-input')
          if (input) {
            input.focus()
            input.select()
            last.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      })
    })

    $('reload-btn').addEventListener('click', async () => {
      if (dirty) {
        openModal({
          title: '放弃修改并重新加载？',
          body:
            '<p>当前有未保存的修改，重新加载后将丢失所有编辑内容。</p>',
          confirmText: '重新加载',
          onConfirm: async function () {
            await loadData()
          },
        })
      } else {
        await loadData()
      }
    })

    $('reset-btn').addEventListener('click', () => {
      if (!dirty) {
        showToast('当前没有未保存的修改', 'warn')
        return
      }
      openModal({
        title: '放弃所有修改？',
        body:
          '<p>将恢复到上次加载/保存时的状态。</p>',
        confirmText: '放弃修改',
        onConfirm: function () {
          data = JSON.parse(JSON.stringify(serverData))
          setDirty(false)
          render()
          showToast('已恢复', 'success')
        },
      })
    })

    $('save-btn').addEventListener('click', () => {
      // 预检：警告信息
      const problemGroups = []
      data.forEach((g, idx) => {
        const a = parseFloat(g.a)
        if (isNaN(a) || a < 0) problemGroups.push({ idx, reason: '金额非法', g })
      })
      const doSave = function () {
        // 清理：去除空名字
        const cleaned = data
          .map((g) => ({
            a: g.a,
            n: (g.n || [])
              .map((n) => String(n).trim())
              .filter((n) => n.length > 0),
          }))
          .filter((g) => {
            const a = parseFloat(g.a)
            return !isNaN(a) && a >= 0
          })
        // 提交
        ;(async () => {
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
        })()
      }

      if (problemGroups.length > 0) {
        openModal({
          title: '发现 ' + problemGroups.length + ' 条问题数据',
          body:
            '<p>以下分组将被丢弃（金额非法），是否仍继续保存？</p>' +
            '<div style="max-height:180px;overflow:auto;margin-top:8px;padding:10px;' +
            'background:var(--card);border:1px solid var(--border);border-radius:8px;">' +
            problemGroups
              .map((p) => {
                return (
                  '<div style="font-size:13px;padding:4px 0;">' +
                  '#{idx} 金额=<code>{a}</code>，{c} 人'
                    .replace('{idx}', p.idx + 1)
                    .replace('{a}', escapeHtml(String(p.g.a)))
                    .replace('{c}', (p.g.n || []).length) +
                  '</div>'
                )
              })
              .join('') +
            '</div>',
          confirmText: '仍然保存',
          onConfirm: doSave,
        })
      } else {
        doSave()
      }
    })

    $('export-btn').addEventListener('click', () => {
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts =
        new Date()
          .toISOString()
          .replace(/[:T]/g, '-')
          .slice(0, 16) + '.json'
      a.download = 'donors-' + ts
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 0)
      showToast('已导出 ' + data.length + ' 个分组', 'success')
    })

    $('import-btn').addEventListener('click', () => {
      const fileInput = $('import-file')
      if (fileInput && typeof fileInput.click === 'function') {
        fileInput.value = ''
        fileInput.click()
      }
    })

    const fileInput = $('import-file')
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target && e.target.files && e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = function (evt) {
          const text = evt.target.result
          openImportModalWithText(text)
        }
        reader.onerror = function () {
          showToast('读取文件失败', 'error')
        }
        reader.readAsText(file, 'utf-8')
      })
    }

    $('preview-btn').addEventListener('click', togglePreview)

    // 搜索
    const searchInput = $('search-input')
    if (searchInput) {
      let searchTimer = null
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(() => {
          searchKeyword = searchInput.value
          render()
        }, 120)
      })
    }

    // 排序
    const sortSelect = $('sort-select')
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        sortMode = sortSelect.value
        render()
      })
    }
  }

  // 导入 JSON 文本模态框（可编辑）
  function openImportModalWithText(initialText) {
    const sampleArr = Array.isArray(initialText)
      ? initialText
      : [{ a: '1.00', n: ['示例用户'] }]
    const initial =
      typeof initialText === 'string' && initialText.trim().length > 0
        ? initialText
        : JSON.stringify(sampleArr, null, 2)

    const body =
      '<div class="modal-note">粘贴或编辑 JSON 数组。格式：<code>[{ "a":"1.00","n":["用户A","用户B"] }]</code></div>' +
      '<textarea id="import-textarea" spellcheck="false">' +
      escapeHtml(initial) +
      '</textarea>' +
      '<div id="import-error" class="parse-error" style="display:none;"></div>'

    openModal({
      title: '导入 JSON',
      body: body,
      confirmText: '导入并替换当前数据',
      onConfirm: function () {
        const ta = document.getElementById('import-textarea')
        const errEl = document.getElementById('import-error')
        if (!ta) return
        try {
          const parsed = JSON.parse(ta.value)
          if (!Array.isArray(parsed)) {
            throw new Error('JSON 顶层必须是数组')
          }
          const normalized = parsed.map((g, i) => {
            if (!g || typeof g !== 'object') {
              throw new Error('第 ' + (i + 1) + ' 项不是对象')
            }
            const aVal = g.a
            const nVal = g.n
            const aNum = parseFloat(aVal)
            if (isNaN(aNum) || aNum < 0) {
              throw new Error('第 ' + (i + 1) + ' 项金额非法: ' + aVal)
            }
            if (!Array.isArray(nVal)) {
              throw new Error('第 ' + (i + 1) + ' 项 n 必须是字符串数组')
            }
            const names = nVal
              .map((x) => String(x).trim())
              .filter((x) => x.length > 0)
            return { a: aNum.toFixed(2), n: names }
          })
          data = normalized
          setDirty(true)
          render()
          showToast('已导入 ' + normalized.length + ' 个分组，记得保存', 'success')
        } catch (e) {
          if (errEl) {
            errEl.style.display = 'block'
            errEl.textContent = '解析失败：' + (e.message || String(e))
          }
          // 重新打开模态框让用户继续编辑
          setTimeout(() => {
            const ta2 = document.getElementById('import-textarea')
            openImportModalWithText(ta2 ? ta2.value : initial)
          }, 0)
        }
      },
    })
  }

  // ─── 键盘快捷键 ─────────────────────────────────────
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey
      // 在输入框/文本框里不拦截常见的编辑键
      const inEditable =
        e.target &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          (e.target.isContentEditable))

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!$('main-view').classList.contains('hidden')) {
          $('save-btn').click()
        }
      } else if (mod && e.key.toLowerCase() === 'z' && !inEditable) {
        // 不使用原生 undo（textarea 内的浏览器默认行为保留）
      } else if (e.key === 'Escape') {
        if (!$('modal').classList.contains('hidden')) {
          closeModal()
        }
      } else if ((e.key === 'Enter') && !$('login-view').classList.contains('hidden')) {
        handleLogin()
      }
    })
  }

  // ─── 离开前提示 ────────────────────────────────────
  function bindBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    })
  }

  // ─── 登录页事件 ─────────────────────────────────────
  function bindLoginEvents() {
    $('login-btn').addEventListener('click', handleLogin)
    const toggle = $('login-toggle')
    if (toggle) {
      toggle.addEventListener('click', () => {
        const input = $('login-token')
        if (!input) return
        input.type = input.type === 'password' ? 'text' : 'password'
      })
    }
  }

  // ─── 启动 ───────────────────────────────────────────
  bindLoginEvents()
  bindCardEvents()
  bindToolbar()
  bindKeyboard()
  bindBeforeUnload()

  $('logout-btn').addEventListener('click', () => {
    if (dirty && !confirm('有未保存修改，确定退出？')) return
    logout()
  })

  tryAutoLogin()
})()
