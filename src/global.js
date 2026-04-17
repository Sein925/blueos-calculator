import router from '@blueos.app.appmanager.router'
import storage from '@blueos.storage.storage'
import fetch from '@blueos.network.fetch'

global.router = router
global.storage = storage
global.fetch = fetch

global.calculatorHistory = []
global.angleMode = 'deg'

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
  try {
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
