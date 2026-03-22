import router from '@blueos.app.appmanager.router'
import storage from '@blueos.storage.storage'

global.router = router

global.calculatorHistory = []
global.angleMode = 'deg'

const HISTORY_STORAGE_KEY = 'calculator_history'
const SETTINGS_STORAGE_KEY = 'calculator_settings'

global.loadHistory = function () {
  try {
    const result = storage.getSync({ key: HISTORY_STORAGE_KEY })
    if (typeof result === 'string' && result) {
      try {
        global.calculatorHistory = JSON.parse(result)
      } catch (e) {
        global.calculatorHistory = []
      }
    } else {
      global.calculatorHistory = []
    }
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
  try {
    const result = storage.getSync({ key: SETTINGS_STORAGE_KEY })
    if (typeof result === 'string' && result) {
      try {
        const settings = JSON.parse(result)
        global.angleMode = settings.angleMode || 'deg'
      } catch (e) {
        global.angleMode = 'deg'
      }
    } else {
      global.angleMode = 'deg'
    }
  } catch (e) {
    global.angleMode = 'deg'
  }
}

global.saveSettings = function () {
  try {
    const settings = {
      angleMode: global.angleMode || 'deg',
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
