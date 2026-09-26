// Any /api path without its own route file under app/api/v1: the API's usual 404, as JSON
function notFound(): Response {
  return Response.json({ statusCode: 404, message: 'Not found' }, { status: 404, headers: { 'cache-control': 'private, no-store' } });
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
