import GUI from "lil-gui"
import "./style.css"
import Router from "vanilla-router"
import { version } from "./package.json"
import ThicknessDemo from "./src/ThicknessDemo"
import MaterialSwapDemo from "./src/MaterialSwapDemo"
import EffectsPlayground from "./src/EffectsPlayground"
import CSGPlayground from "./src/CSGPlayground"
import VehicleShowcase from "./src/VehicleShowcase"
import AnisotropyAngel from "./src/AnisotropyAngel"

const gui = new GUI({ title: "Demos: v" + version, closeFolders: true })
if (window.innerWidth < window.innerHeight) {
  gui.close()
}

const params = {
  demo: null,
  homeButton: () => {
    router.redirectTo("Home")
    location.reload()
  },
}

const Demos = {
  Home: () => HomeDemo(),
  Thickness: ThicknessDemo,
  MaterialSwap: MaterialSwapDemo,
  EffectsPlayground: EffectsPlayground,
  CSGPlayground: CSGPlayground,
  VehicleShowcase: VehicleShowcase,
  AnisotropyAngel: AnisotropyAngel,
}

gui.add(params, "homeButton").name("🔙Home")

const demoContainer = document.createElement("div")
demoContainer.classList.add("demo-container")
document.body.appendChild(demoContainer)

const HomeDemo = () => {
  gui.destroy()
  for (const name of Object.keys(Demos)) {
    if (name === "Home") continue
    const button = document.createElement("button")
    button.innerHTML = name
    demoContainer.appendChild(button)
    button.classList.add("demo-button")
    button.onclick = () => {
      router.redirectTo(name)
      location.reload()
    }
  }
}

if (Object.keys(Demos).includes(window.location.hash.substring(1))) {
  params.demo = window.location.hash.substring(1)
}

// gui.add(params, "demo", Object.keys(Demos)).onChange((v) => {
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

for (const [demoName, demoFunc] of Object.entries(Demos)) {
  router.add(demoName, () => demoFunc(gui))
}

router.check()
