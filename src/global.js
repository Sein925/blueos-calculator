import router from '@blueos.app.appmanager.router'
import storage from '@blueos.storage.storage'

global.router = router

global.calculatorHistory = []

const HISTORY_STORAGE_KEY = 'calculator_history'

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
