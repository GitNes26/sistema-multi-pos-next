// Vuelve a montar un video (zooms/voz) desde su estado guardado, sin regrabar:  node scripts/promo/rerender.mjs <archivo.mp4>
import fs from "node:fs"
import { render } from "./lib.mjs"
const out = process.argv[2]
const st = JSON.parse(fs.readFileSync(out + ".state.json", "utf8"))
render({ scenes: st.scenes, track: { audio: st.audio }, out })
