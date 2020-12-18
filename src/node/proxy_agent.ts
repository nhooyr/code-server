import { logger } from "@coder/logger"
import * as http from "http"
import * as proxyagent from "proxy-agent"

/**
 * This file does not have anything to do with the code-server proxy.
 * It's for $HTTP_PROXY and $HTTPS_PROXY support!
 * - https://github.com/cdr/code-server/issues/124
 * - https://www.npmjs.com/package/proxy-agent
 *
 * This file exists in two locations:
 * - src/node/proxy_agent.ts
 * - lib/vscode/src/vs/base/node/proxy_agent.ts
 * The second is a symlink to the first.
 */

/**
 * monkeyPatch patches the default agents of the node http/https modules to
 * route all requests through our custom agents from the proxy-agent package.
 *
 * This approach only works if there is no code specifying a explicit agent when making
 * a request.
 *
 * None of our code ever passes in a explicit agent to the http/https modules but
 * VS Code's does sometimes but only when a user sets the http.proxy configuration.
 * See https://code.visualstudio.com/docs/setup/network#_legacy-proxy-server-support
 *
 * Even if they do, it's probably the same proxy so we should be fine! And those are
 * deprecated anyway. In fact, they implemented it incorrectly as they won't retrieve
 * HTTPS resources over a HTTP proxy which is perfectly valid! Both HTTP and HTTPS proxies
 * support HTTP/HTTPS resources.
 *
 * See https://stackoverflow.com/a/10442767/4283659
 *
 * As for us, we implement the logic as so:
 *
 * If $HTTP_PROXY != "":
 *   Then we use it for both HTTP/HTTPS resources.
 * If $HTTPS_PROXY != "":
 *   Then we use it for both HTTP/HTTPS resources.
 * If $HTTP_PROXY != "" && $HTTPS_PROXY != "":
 *   We use $HTTP_PROXY for HTTP requests as the proxy can cache responses.
 *   But then we use $HTTPS_PROXY for HTTPS requests for end to end security.
 */
export function monkeyPatch(inVSCode: boolean): void {
  const http = require("http")
  const https = require("https")

  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  if (httpProxy) {
    logger.debug(`using $HTTP_PROXY ${httpProxy}`)

    const httpProxyAgent = newProxyAgent(inVSCode, httpProxy)
    http.globalAgent = httpProxyAgent
    https.globalAgent = httpProxyAgent
  }

  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  if (httpsProxy) {
    logger.debug(`using $HTTPS_PROXY ${httpsProxy}`)

    const httpsProxyAgent = newProxyAgent(inVSCode, httpsProxy)
    if (!httpProxy) {
      http.globalAgent = httpsProxyAgent
    }
    https.globalAgent = httpsProxyAgent
  }
}

function newProxyAgent(inVSCode: boolean, proxyURL: string): http.Agent {
  let pa: http.Agent
  // The reasoning for this split is that VS Code's build process does not have
  // esModuleInterop enabled but the code-server one does. As a result depending on where
  // we execute, we either have a default attribute or we don't.
  //
  // I can't enable esModuleInterop in VS Code's build process as it breaks and spits out
  // a huge number of errors.
  if (inVSCode) {
    pa = new (proxyagent as any)(proxyURL)
  } else {
    pa = new (proxyagent as any).default(proxyURL)
  }
  return pa
}
