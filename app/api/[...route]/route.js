// All /api/* requests go to lib/server.js, with the Cloudflare bindings
// (D1 database, password secrets) from getCloudflareContext.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleApi } from "@/lib/server";

export const dynamic = "force-dynamic";

async function handler(req) {
  // cf: where the request comes from (city, country), shown in Settings > Account > Signed-in devices.
  const { env, cf } = await getCloudflareContext({ async: true });
  return handleApi(req, env, cf || {});
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
