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
      '<div class="duplicate-tip" style="display:none;margin-top:8px;"></div>' +
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
    const onCancel = opts.onCancel || null
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
      if (typeof onCancel === 'function') onCancel()
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

  // ─── 快速添加支持者 ───────────────────────────────
  //
  // 通过模态框输入金额 + 姓名，系统自动判断：
  //   1. 若已有同金额分组 → 追加到该分组
  //   2. 若无 → 新建分组
  //   3. 若姓名已存在于其他金额分组 → 询问是否合并到更高金额分组

  function openAddModal() {
    openModal({
      title: '新增支持者',
      body:
        '<p class="muted">输入金额和支持者姓名（每行一个）。系统会自动查找同金额分组并追加。</p>' +
        '<div class="form-row">' +
        '<label>金额 (¥)</label>' +
        '<input id="add-amount" class="amount-input" type="number" inputmode="decimal" step="0.01" min="0" placeholder="例如 5.00" />' +
        '</div>' +
        '<div class="form-row">' +
        '<label>支持者姓名（每行一个）</label>' +
        '<textarea id="add-names" class="names-input" rows="4" placeholder="张三&#10;李四&#10;王五"></textarea>' +
        '</div>',
      confirmText: '添加',
      cancelText: '取消',
      onConfirm: function () {
        const amountEl = document.getElementById('add-amount')
        const namesEl = document.getElementById('add-names')
        if (!amountEl || !namesEl) return
        const amount = String(amountEl.value).trim()
        const namesRaw = namesEl.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)

        // 校验
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          showToast('请输入有效的金额（大于 0）', 'error')
          return
        }
        if (namesRaw.length === 0) {
          showToast('请输入至少一个支持者姓名', 'error')
          return
        }

        const a = parseFloat(amount).toFixed(2)
        const aNum = parseFloat(a)

        // 去重（同一批输入中避免重复姓名）
        const seen = new Set()
        const names = []
        namesRaw.forEach((n) => {
          if (!seen.has(n)) {
            seen.add(n)
            names.push(n)
          }
        })

        // 检查这些姓名是否已存在于其他分组
        const existing = [] // [{name, groups: [{idx, a, amount}]}]
        data.forEach((g, idx) => {
          if (!g || !Array.isArray(g.n)) return
          const ga = parseFloat(g.a)
          g.n.forEach((name) => {
            const clean = String(name).trim()
            if (!clean) return
            if (names.includes(clean)) {
              let item = existing.find((e) => e.name === clean)
              if (!item) {
                item = { name: clean, groups: [] }
                existing.push(item)
              }
              item.groups.push({ idx, a: isNaN(ga) ? 0 : ga, amount: String(g.a) })
            }
          })
        })

        // 找出同金额的分组（供后续追加）
        let sameAmountIdx = -1
        data.forEach((g, idx) => {
          if (!g) return
          const ga = parseFloat(g.a)
          if (!isNaN(ga) && Math.abs(ga - aNum) < 0.001 && sameAmountIdx === -1) {
            sameAmountIdx = idx
          }
        })

        // 确定每个新姓名要放到哪个分组：
        //   - 如果姓名已存在于金额 >= 新金额的分组 → 该分组就是目标
        //   - 如果姓名只存在于金额 < 新金额的分组 → 目标是新金额分组
        //   - 如果姓名全新 → 目标是新金额分组
        // 对于那些需要合并到其他分组的姓名，先弹窗询问用户

        const needAsk = [] // 需要询问的姓名
        const addToSame = [] // 可以直接加到同金额分组的姓名（或新建）
        const alreadyHigher = [] // 已在更高或相同金额分组

        names.forEach((name) => {
          const ex = existing.find((e) => e.name === name)
          if (!ex) {
            addToSame.push(name)
            return
          }
          // 检查是否已有 >= 新金额的分组包含该姓名
          const higherOrSame = ex.groups.some((g) => g.a >= aNum - 0.001)
          if (higherOrSame) {
            alreadyHigher.push(name)
          } else {
            // 只在更低金额分组中出现 → 询问是否移到新金额分组
            needAsk.push({ name, groups: ex.groups })
          }
        })

        const finalizeAdd = function () {
          // 执行实际添加
          if (addToSame.length > 0) {
            if (sameAmountIdx >= 0) {
              data[sameAmountIdx].n = data[sameAmountIdx].n.concat(addToSame)
            } else {
              data.push({ a: a, n: addToSame.slice() })
            }
          }
          setDirty(true)
          render()
          const totalAdded = addToSame.length
          let msg = '添加完成'
          if (totalAdded > 0) {
            msg = '成功添加 ' + totalAdded + ' 位支持者（金额 ¥' + a + '）'
            if (alreadyHigher.length > 0) {
              msg += '；' + alreadyHigher.length + ' 位已存在于更高金额分组，已跳过'
            }
          } else if (alreadyHigher.length > 0) {
            msg = alreadyHigher.length + ' 位支持者已在更高金额分组中，无需添加'
          }
          showToast(msg, 'success')
        }

        // 如果有需要询问的姓名 → 逐个询问
        if (needAsk.length > 0) {
          let i = 0
          const askNext = function () {
            if (i >= needAsk.length) {
              finalizeAdd()
              return
            }
            const item = needAsk[i]
            i++
            const groupsHtml = item.groups
              .map(
                (g) =>
                  '<li>分组 #' +
                  (g.idx + 1) +
                  ' · 金额 ' +
                  escapeHtml(formatAmount(g.a)) +
                  '</li>'
              )
              .join('')
            openModal({
              title: '「' + escapeHtml(item.name) + '」已在其他分组',
              body:
                '<p class="muted">该姓名已出现在较低金额分组中。是否合并到新金额分组（¥' +
                escapeHtml(a) +
                '）？</p>' +
                '<ul style="list-style:disc;margin:10px 0 10px 24px;line-height:1.8;">' +
                groupsHtml +
                '</ul>' +
                '<p class="muted">选择「合并」后，该姓名将从以上分组移到新金额分组（¥' +
                escapeHtml(a) +
                '），空分组会自动删除；选择「保留」则跳过该姓名。</p>',
              confirmText: '合并到 ¥' + a,
              cancelText: '保留不动',
              onConfirm: function () {
                // 从原分组删除
                item.groups.forEach((g) => {
                  const grp = data[g.idx]
                  if (grp && Array.isArray(grp.n)) {
                    grp.n = grp.n.filter((n) => String(n).trim() !== item.name)
                  }
                })
                // 加到目标分组（或新建）
                if (sameAmountIdx >= 0) {
                  if (!data[sameAmountIdx].n.some((n) => String(n).trim() === item.name)) {
                    data[sameAmountIdx].n.push(item.name)
                  }
                } else {
                  // 需要新建一个分组作为目标
                  let targetIdx = data.length
                  let found = data.find((g, idx) => {
                    const ga = parseFloat(g.a)
                    return !isNaN(ga) && Math.abs(ga - aNum) < 0.001
                  })
                  if (found) {
                    // 重新找索引
                    for (let j = 0; j < data.length; j++) {
                      const ga = parseFloat(data[j].a)
                      if (!isNaN(ga) && Math.abs(ga - aNum) < 0.001) {
                        targetIdx = j
                        break
                      }
                    }
                    if (targetIdx < data.length && !data[targetIdx].n.some((n) => String(n).trim() === item.name)) {
                      data[targetIdx].n.push(item.name)
                    }
                  } else {
                    data.push({ a: a, n: [item.name] })
                    sameAmountIdx = data.length - 1
                  }
                }
                // 清理空分组
                cleanupEmptyGroups()
                setDirty(true)
                showToast('已合并「' + item.name + '」到 ¥' + a + ' 分组', 'success')
                askNext()
              },
              onCancel: askNext,
            })
          }
          askNext()
        } else {
          finalizeAdd()
        }
      },
    })

    // 聚焦到金额输入框
    requestAnimationFrame(() => {
      const el = document.getElementById('add-amount')
      if (el) el.focus()
    })
  }

  // ─── 重复姓名检测 & 合并 ────────────────────────
  //
  // 返回值: [{ name, groups: [{idx, a, countInGroup}] }]
  // 其中 groups 长度 > 1 表示该姓名出现在多个分组。
  function findDuplicates() {
    const nameMap = new Map() // name → [{idx, a, countInGroup}]
    data.forEach((g, idx) => {
      if (!g || !Array.isArray(g.n)) return
      const a = parseFloat(g.a)
      g.n.forEach((name) => {
        const clean = String(name).trim()
        if (clean.length === 0) return
        if (!nameMap.has(clean)) nameMap.set(clean, [])
        nameMap.get(clean).push({ idx, a: isNaN(a) ? 0 : a, amount: String(g.a) })
      })
    })
    const result = []
    for (const [name, arr] of nameMap.entries()) {
      if (arr.length > 1) {
        result.push({ name, groups: arr })
      }
    }
    return result
  }

  // 把姓名从低金额分组移动到高金额分组（合并），
  // 如果高金额组和低金额组金额相同，则保留第一个出现的分组
  // 返回: { moved: true/false, fromIdx, toIdx, name }
  function mergeDuplicate(name, groups) {
    if (!Array.isArray(groups) || groups.length < 2) return null

    // 找到金额最高的分组（作为目标），其余的都是源
    let toGroup = groups[0]
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].a > toGroup.a) toGroup = groups[i]
    }

    const toIdx = toGroup.idx
    const results = []
    groups.forEach((g) => {
      if (g.idx === toIdx) return
      // 把姓名从 data[g.idx].n 中删除
      const group = data[g.idx]
      if (!group || !Array.isArray(group.n)) return
      // 删除所有匹配这个姓名的条目（包括前后可能有空格）
      const beforeLen = group.n.length
      group.n = group.n.filter((n) => String(n).trim() !== name)
      if (group.n.length < beforeLen) {
        results.push({ fromIdx: g.idx, toIdx, name, fromAmount: g.amount, toAmount: toGroup.amount })
      }
    })

    // 如果目标分组原本就有这个姓名，不需要再加（去重）
    const targetGroup = data[toIdx]
    if (targetGroup && Array.isArray(targetGroup.n)) {
      if (!targetGroup.n.some((n) => String(n).trim() === name)) {
        targetGroup.n.push(name)
        // 如果上面 forEach 中没有实际移动的记录（例如本来目标分组已经有），
        // 这里会手动补一条合并记录用于提示
        if (results.length === 0) {
          results.push({ fromIdx: -1, toIdx, name, fromAmount: '—', toAmount: toGroup.amount })
        }
      }
    }

    return results
  }

  // 合并后清理空分组
  function cleanupEmptyGroups() {
    const before = data.length
    data = data.filter((g) => {
      const a = parseFloat(g.a)
      const hasPeople = Array.isArray(g.n) && g.n.length > 0
      if (!hasPeople && (isNaN(a) || a <= 0)) return false // 金额 <= 0 且无人 → 删除
      if (!hasPeople) return false
      return true
    })
    return before - data.length
  }

  // 处理单个重复项：弹窗询问是否合并
  function askAndMergeOne(item, onDone) {
    const groupsHtml = item.groups
      .map(
        (g) =>
          '<li>分组 #' +
          (g.idx + 1) +
          ' · 金额 ' +
          escapeHtml(formatAmount(g.a)) +
          '</li>'
      )
      .join('')

    openModal({
      title: '发现重复支持者：' + escapeHtml(item.name),
      body:
        '<p class="muted">该姓名出现在多个分组，是否合并到金额最高的那个分组？</p>' +
        '<ul style="list-style:disc;margin:10px 0 10px 24px;line-height:1.8;">' +
        groupsHtml +
        '</ul>' +
        '<p class="muted">选择「合并」后，空分组会自动删除；选择「保留」将保持不变。</p>',
      confirmText: '合并到最高金额分组',
      cancelText: '保留不合并',
      onConfirm: function () {
        const results = mergeDuplicate(item.name, item.groups)
        if (results && results.length > 0) {
          setDirty(true)
          render()
          showToast('已合并「' + item.name + '」', 'success')
        } else {
          showToast('没有需要合并的内容', 'warn')
        }
        if (onDone) onDone()
      },
      onCancel: onDone,
    })
  }

  // 处理全部重复项（用于保存前预检）
  function processAllDuplicates(onFinal) {
    const dups = findDuplicates()
    if (dups.length === 0) {
      onFinal()
      return
    }

    let i = 0
    const step = () => {
      if (i >= dups.length) {
        onFinal()
        return
      }
      const item = dups[i]
      i++
      // 检测当前这个名字是否还重复（可能因为前面的合并已经处理了）
      const latest = findDuplicates()
      const stillThere = latest.find((d) => d.name === item.name)
      if (!stillThere) {
        step()
        return
      }
      askAndMergeOne(stillThere, step)
    }
    step()
  }

  // 检测某个分组当前刚输入的姓名是否已经存在别处
  function detectDuplicateInName(name) {
    const clean = String(name).trim()
    if (clean.length === 0) return null
    const dups = findDuplicates()
    return dups.find((d) => d.name === clean) || null
  }

  // ─── 事件委托：编辑 ─────────────────────────────────
  function bindCardEvents() {
    // 避免每次输入都弹窗询问合并
    let _modalOpen = false
    function markModalOpen(v) { _modalOpen = v }

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

        // 检测：当前分组中有哪些姓名和其他分组冲突
        const dupTips = card && card.querySelector('.duplicate-tip')
        if (dupTips) {
          const dupsHere = []
          const allDups = findDuplicates()
          for (const d of allDups) {
            if (d.groups.some((g) => g.idx === idx)) dupsHere.push(d)
          }
          if (dupsHere.length > 0) {
            const namesHtml = dupsHere
              .map((d) => {
                const otherGroup = d.groups.find((g) => g.idx !== idx)
                const otherAmount = otherGroup
                  ? formatAmount(otherGroup.a)
                  : ''
                return (
                  '<span class="chip warn" title="与 ' +
                  escapeHtml(otherAmount) +
                  ' 的分组冲突">' +
                  escapeHtml(d.name) +
                  '</span>'
                )
              })
              .join('')
            dupTips.innerHTML =
              '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
              '<span style="color:var(--text-muted);font-size:12px;">检测到重复姓名：</span>' +
              namesHtml +
              '</div>'
            dupTips.style.display = 'block'
          } else {
            dupTips.innerHTML = ''
            dupTips.style.display = 'none'
          }
        }
      }

      updateStats()
      renderPreview()
      setDirty(true)
    })

    // names-input 失焦时：如果刚输入的姓名有重复，弹窗询问是否合并
    listEl.addEventListener('blur', (e) => {
      if (_modalOpen) return
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      if (t.tagName !== 'TEXTAREA' || t.dataset.field !== 'n') return
      const idx = parseInt(t.dataset.idx, 10)
      if (isNaN(idx)) return

      // 如果当前分组有新检测到的重复项，弹出一次合并询问（只处理第一个，避免过多弹窗）
      const dups = findDuplicates()
      const dupHere = dups.find((d) => d.groups.some((g) => g.idx === idx))
      if (dupHere && dups.length > 0) {
        _modalOpen = true
        askAndMergeOne(dupHere, () => {
          cleanupEmptyGroups()
          setDirty(true)
          render()
          _modalOpen = false
        })
      }
    }, true)

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
      openAddModal()
    })

    $('add-group-btn').addEventListener('click', () => {
      data.push({ a: '1.00', n: [''] })
      setDirty(true)
      render()
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
      // 预检 1：是否有重复姓名
      const dups = findDuplicates()
      const doSave = function () {
        // 预检 2：非法金额
        const problemGroups = []
        data.forEach((g, idx) => {
          const a = parseFloat(g.a)
          if (isNaN(a) || a < 0) problemGroups.push({ idx, reason: '金额非法', g })
        })

        const commit = function () {
          // 清理：去除空名字，移除空分组
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
            onConfirm: commit,
          })
        } else {
          commit()
        }
      }

      // 如果有重复，先询问合并
      if (dups.length > 0) {
        const summary = dups
          .slice(0, 6)
          .map((d) => {
            const amounts = d.groups
              .map((g) => formatAmount(g.a))
              .join(' / ')
            return (
              '<li>' +
              escapeHtml(d.name) +
              '（出现在 ' +
              d.groups.length +
              ' 个分组：' +
              escapeHtml(amounts) +
              '）</li>'
            )
          })
          .join('')
        const more = dups.length > 6
          ? '<p style="margin-top:6px;">…以及其他 ' + (dups.length - 6) + ' 个重复姓名</p>'
          : ''

        openModal({
          title: '发现 ' + dups.length + ' 个重复支持者',
          body:
            '<p class="muted">以下姓名出现在多个分组中。逐个询问是否合并到金额最高的分组？</p>' +
            '<ul style="list-style:disc;margin:10px 0 10px 24px;line-height:1.8;">' +
            summary +
            '</ul>' +
            more,
          confirmText: '逐个询问并合并',
          cancelText: '跳过，直接保存',
          onConfirm: function () {
            processAllDuplicates(doSave)
          },
          onCancel: doSave,
        })
        return
      }

      // 没有重复，直接保存
      doSave()
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
