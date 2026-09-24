/**
 * The one entry point the web app uses from the API package (apps/web/server/src/embedded.ts). The
 * package is loaded with Node's require at run time (serverExternalPackages), not compiled with the
 * web app, so its types are declared here.
 */
declare module '@ems/backend' {
  export interface EmbeddedApi {
    origin: string;
    close(): Promise<void>;
  }
  export function startEmbeddedApi(): Promise<EmbeddedApi>;
}
