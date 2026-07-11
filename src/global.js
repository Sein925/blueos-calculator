import router from '@blueos.app.appmanager.router'
import storage from '@blueos.storage.storage'
import fetch from '@blueos.network.fetch'
import device from '@blueos.hardware.deviceInfo'
import app from '@blueos.app.context'

global.router = router
global.storage = storage
global.fetch = fetch
global.device = device
global.app = app

global.calculatorHistory = []
global.angleMode = 'deg'
global.equationOutputMode = 'exact'
global.inputDisplayMode = 'static'
global.pendingHistoryItem = null
global.pendingDateValue = ''

const HISTORY_STORAGE_KEY = 'calculator_history'
const SETTINGS_STORAGE_KEY = 'calculator_settings'

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

global.loadSettings()
