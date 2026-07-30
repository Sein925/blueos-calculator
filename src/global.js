import router from '@blueos.app.appmanager.router'
import storage from '@blueos.storage.storage'
import fetch from '@blueos.network.fetch'
import device from '@blueos.hardware.deviceInfo'
import app from '@blueos.app.context'
import vibrator from '@blueos.hardware.vibrator.vibrator'

global.router = router
global.storage = storage
global.fetch = fetch
global.device = device
global.app = app
global.vibrator = vibrator

global.calculatorHistory = []
global.angleMode = 'deg'
global.equationOutputMode = 'exact'
global.inputDisplayMode = 'static'
global.hapticEnabled = false
global.pendingHistoryItem = null
global.pendingDateValue = ''
global.pinnedFeatures = {}

const HISTORY_STORAGE_KEY = 'calculator_history'
const SETTINGS_STORAGE_KEY = 'calculator_settings'
const PINNED_STORAGE_KEY = 'calculator_pinned_features'

global.loadHistory = function () {
  try {
    storage.get({
      key: HISTORY_STORAGE_KEY,
      success: function (data) {
        if (data) {
          try {
            global.calculatorHistory = JSON.parse(data)
          } catch (e) {
            global.calculatorHistory = []
          }
        } else {
          global.calculatorHistory = []
        }
      },
      fail: function () {
        global.calculatorHistory = []
      },
    })
  } catch (e) {
    global.calculatorHistory = []
  }
}

global.saveHistory = function () {
  try {
    storage.set({
      key: HISTORY_STORAGE_KEY,
      value: JSON.stringify(global.calculatorHistory),
      success: function () {
      },
      fail: function () {
      },
    })
  } catch (e) {
  }
}

global.loadSettings = function () {
  const applyDefaults = function () {
    global.angleMode = 'deg'
    global.equationOutputMode = 'exact'
    global.inputDisplayMode = 'static'
    global.hapticEnabled = false
  }
  try {
    storage.get({
      key: SETTINGS_STORAGE_KEY,
      success: function (data) {
        if (data) {
          try {
            const settings = JSON.parse(data)
            global.angleMode = settings.angleMode || 'deg'
            global.equationOutputMode = settings.equationOutputMode || 'exact'
            global.inputDisplayMode = settings.inputDisplayMode || 'marquee'
            global.hapticEnabled = settings.hapticEnabled === true
          } catch (e) {
            applyDefaults()
          }
        } else {
          applyDefaults()
        }
      },
      fail: function () {
        applyDefaults()
      },
    })
  } catch (e) {
    applyDefaults()
  }
}

global.saveSettings = function () {
  try {
    const settings = {
      angleMode: global.angleMode || 'deg',
      equationOutputMode: global.equationOutputMode || 'exact',
      inputDisplayMode: global.inputDisplayMode || 'marquee',
      hapticEnabled: global.hapticEnabled === true,
    }
    storage.set({
      key: SETTINGS_STORAGE_KEY,
      value: JSON.stringify(settings),
      success: function () {
      },
      fail: function () {
      },
    })
  } catch (e) {
  }
}

// 触发短振动（仅当 hapticEnabled 为 true）
global.triggerHaptic = function () {
  if (!global.hapticEnabled) return
  try {
    global.vibrator.vibrate({ mode: 'short' })
  } catch (e) {
    // 设备不支持振动时静默失败
  }
}

global.loadPinnedFeatures = function () {
  try {
    storage.get({
      key: PINNED_STORAGE_KEY,
      success: function (data) {
        if (data) {
          try {
            global.pinnedFeatures = JSON.parse(data) || {}
          } catch (e) {
            global.pinnedFeatures = {}
          }
        } else {
          global.pinnedFeatures = {}
        }
      },
      fail: function () {
        global.pinnedFeatures = {}
      },
    })
  } catch (e) {
    global.pinnedFeatures = {}
  }
}

global.savePinnedFeatures = function () {
  try {
    storage.set({
      key: PINNED_STORAGE_KEY,
      value: JSON.stringify(global.pinnedFeatures),
      success: function () {
      },
      fail: function () {
      },
    })
  } catch (e) {
  }
}

global.loadSettings()
global.loadPinnedFeatures()
