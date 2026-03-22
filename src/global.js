import router from '@blueos.app.appmanager.router'
import storage from '@blueos.storage.storage'

global.router = router

global.calculatorHistory = []
global.angleMode = 'deg'

const HISTORY_STORAGE_KEY = 'calculator_history'
const SETTINGS_STORAGE_KEY = 'calculator_settings'

global.loadHistory = function () {
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
}

global.saveHistory = function () {
  storage.set({
    key: HISTORY_STORAGE_KEY,
    value: JSON.stringify(global.calculatorHistory),
    success: function () {
    },
    fail: function () {
    },
  })
}

global.loadSettings = function () {
  storage.get({
    key: SETTINGS_STORAGE_KEY,
    success: function (data) {
      if (data) {
        try {
          const settings = JSON.parse(data)
          global.angleMode = settings.angleMode || 'deg'
        } catch (e) {
          global.angleMode = 'deg'
        }
      } else {
        global.angleMode = 'deg'
      }
    },
    fail: function () {
      global.angleMode = 'deg'
    },
  })
}

global.saveSettings = function () {
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
}

global.loadSettings()
