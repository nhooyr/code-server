import * as wtfnode from "wtfnode"

let active = false

export function setup(): void {
  if (active) {
    return
  }

  const wtfnodeDump = () => {
    wtfnode.dump()
    const t = setTimeout(wtfnodeDump, 5000)
    t.unref()
  }
  const t = setTimeout(wtfnodeDump, 5000)
  t.unref()
}
