export const KUAIZHIFU_CONFIG = {
  pid: '2134',
  key: 't6rrhSHssQohmRbsPsoPgS66GH60D60O',
  submitUrl: 'https://www.kuaizhifu.cn/submit.php',
  apiUrl: 'https://www.kuaizhifu.cn/mapi.php'
};

export const packageNames = {
  'month': '月卡',
  'quarter': '季卡',
  'year': '年卡',
  'permanent': '永久卡'
};

export const packagePrices = {
  'month': 1.00,
  'quarter': 2.00,
  'year': 6.00,
  'permanent': 9.00
};

export async function requestKuaizhifuApi(params) {
  console.log('[KuaiZhiFu] 调用API，参数:', params);
  
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, value);
  }
  
  console.log('[KuaiZhiFu] 请求URL:', KUAIZHIFU_CONFIG.apiUrl);
  
  const response = await fetch(KUAIZHIFU_CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });
  
  console.log('[KuaiZhiFu] 响应状态:', response.status);
  
  const result = await response.json();
  console.log('[KuaiZhiFu] 响应数据:', result);
  
  return result;
}
