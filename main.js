import GUI from "lil-gui"
import "./style.css"
import Router from "vanilla-router"
import { version } from "./package.json"
import ThicknessDemo from "./src/ThicknessDemo"

const gui = new GUI({ title: "Demos: v" + version, closeFolders: true })
if (window.innerWidth < window.innerHeight) {
  gui.close()
}

const params = {
  demo: null,
}

const demos = {
  Home: () => {
    console.log("Home page")
  },
  Thickness: ThicknessDemo,
}

if (Object.keys(demos).includes(window.location.hash.substring(1))) {
  params.demo = window.location.hash.substring(1)
}

// gui.add(params, "demo", Object.keys(demos)).onChange((v) => {
//   router.redirectTo(v)
//   location.reload()
// })

var router = new Router({
  mode: "hash",
  page404: (path) => {
    console.log('"/' + path + '" Page not found')
    router.redirectTo("Home")
    location.reload()
  },
})

for (const [demoName, demoFunc] of Object.entries(demos)) {
  router.add(demoName, () => demoFunc(gui))
}

router.check()
