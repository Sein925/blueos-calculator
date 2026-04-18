export function onRequest(context) {
  return new Response(JSON.stringify({
    status: 'ok',
    message: '服务正常'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
