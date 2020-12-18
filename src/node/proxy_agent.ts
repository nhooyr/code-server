import { logger } from "@coder/logger"
import * as http from "http"
import * as proxyagent from "proxy-agent"

/**
 * This file does not have anything to do with the code-server proxy.
 * It's for $HTTP_PROXY/$HTTPS_PROXY support!
 * - https://github.com/cdr/code-server/issues/124
 * - https://www.npmjs.com/package/proxy-agent
 *
 * This file exists in two locations:
 * - src/node/proxy_agent.ts
 * - lib/vscode/src/vs/base/node/proxy_agent.ts
 * The second is a symlink to the first.
 */

/**
 * monkeyPatch patches the node HTTP/HTTPS library to route all requests through our
 * custom agents from the proxy-agent package.
 *
 * None of our code ever passes in a explicit agent to the http modules but VS Code's
 * does sometimes but only when a user sets the http.proxy configuration.
 * See https://code.visualstudio.com/docs/setup/network#_legacy-proxy-server-support
 *
 * Even if they do, it's probably the same proxy so we should be fine! And those are
 * deprecated anyway.
 */
export function monkeyPatch(vscode: boolean): void {
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  if (httpProxy) {
    logger.debug(`using $HTTPS_PROXY ${httpProxy}`)

    const pa = newProxyAgent(httpProxy)
    const http = require("http")
    http.globalAgent = pa
  }

  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  if (httpsProxy) {
    logger.debug(`using $HTTP_PROXY ${httpsProxy}`)

    const pa = newProxyAgent(httpsProxy)
    const https = require("https")
    https.globalAgent = pa
  }
}

function newProxyAgent(proxyURL: string): http.Agent {
  let pa: http.Agent
  // The reasoning for this split is that VS Code's build process does not have
  // esModuleInterop enabled but the code-server one does. As a result depending on where
  // we execute, we either have a default attribute or we don't.
  //
  // I can't enable esModuleInterop in VS Code's build process as it breaks and spits out
  // a huge number of errors.
  if (vscode) {
    pa = new (proxyagent as any)(httpProxy)
  } else {
    pa = new (proxyagent as any).default(httpProxy)
  }
  return pa
}
