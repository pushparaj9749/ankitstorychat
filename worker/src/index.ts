/**
 * Kissa story content API — Cloudflare Worker entry.
 *
 * NOTE: this module must export ONLY the default handler. workerd treats any
 * other *value* export as a runtime binding and fails to start
 * ("Incorrect type for map entry"). All logic lives in ./router and is
 * unit-tested from there.
 */
import { handleRequest } from './router';

export default {
  fetch(request: Request, env: unknown, _ctx: unknown): Promise<Response> {
    return handleRequest(request, env as never);
  },
};
