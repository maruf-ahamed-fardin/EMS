// Stand-in for the API package (apps/web/server), which is only built by `yarn build`. Web tests never
// start the API; this only lets lib/embedded-api.ts resolve its import of '@ems/backend'.
export async function startEmbeddedApi(): Promise<never> {
  throw new Error('The API package is not available in web tests');
}
