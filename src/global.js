/**
 * 将常用的 Feature API 挂载到 global 下，方便项目使用
 * 如果需要增加全局变量，请同步更新 app.d.ts，可用于代码提示、错误检测
 */
import router from '@blueos.app.appmanager.router'
import device from '@blueos.hardware.deviceInfo'
import fetch from '@blueos.network.fetch'

device.getDeviceId({
  success: function (data) {
    global.deviceId = data.deviceId
  },
  fail: function (code) {
    console.log(`handling fail, code = ${code}`)
  },
})

global.router = router
global.fetch = fetch.fetch

global.calculatorHistory = []
global.backendUrl = 'https://calculator.666-114514.eu.org'
