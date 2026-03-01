/**
 * 将常用的 Feature API 挂载到 global 下，方便项目使用
 * 如果需要增加全局变量，请同步更新 app.d.ts，可用于代码提示、错误检测
 */
import router from '@blueos.app.appmanager.router'
import device from '@blueos.hardware.deviceInfo'
import fetch from '@blueos.network.fetch'
import storage from '@blueos.storage.storage'

const FAIL_MESSAGE = '获取失败，请联系作者'

if (device.getDeviceId) {
  device.getDeviceId({
    success: function (data) {
      global.deviceId = data.deviceId
    },
    fail: function (code) {
      console.log(`handling fail, code = ${code}`)
      global.deviceId = FAIL_MESSAGE
    },
  })
} else if (device.getId) {
  device.getId({
    type: ['device'],
    success: function (data) {
      global.deviceId = data.device || FAIL_MESSAGE
    },
    fail: function (code) {
      console.log(`handling fail, code = ${code}`)
      global.deviceId = FAIL_MESSAGE
    },
  })
} else {
  global.deviceId = FAIL_MESSAGE
  console.log('Device ID API not available')
}

global.isDeviceIdValid = function () {
  return !!(global.deviceId && global.deviceId !== FAIL_MESSAGE)
}

global.router = router
global.fetch = fetch.fetch
global.storage = storage

global.calculatorHistory = []
global.backendUrl = 'https://calculator.666-114514.eu.org'

global.savePaymentStatus = function (isPaid) {
  storage.set({
    key: 'payment_status',
    value: isPaid ? 'paid' : 'unpaid',
    success: function () {
      console.log('支付状态保存成功')
    },
    fail: function (code, data) {
      console.log('支付状态保存失败:', code, data)
    },
  })
}

global.getPaymentStatus = function (callback) {
  storage.get({
    key: 'payment_status',
    success: function (data) {
      callback(data.value === 'paid')
    },
    fail: function (code, data) {
      console.log('获取支付状态失败:', code, data)
      callback(false)
    },
  })
}
