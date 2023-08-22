import "./style.css"

const params = {
  demo: null,
  homeButton: () => {
    window.location.href = "https://three-demos.vercel.app/#Home"
  },
}

const Demos = {
  Home: () => HomeDemo(),
  Thickness: async (gui) => {},
  EffectsPlayground: async (gui) => {},
  AnisotropyAngel: async (gui) => {},
  Caustics: async (gui) => {},
}

const demoContainer = document.createElement("div")
demoContainer.classList.add("demo-container")
document.body.appendChild(demoContainer)

const HomeDemo = () => {
  for (const name of Object.keys(Demos)) {
    if (name === "Home") continue

    const button = document.createElement("button")
    button.innerHTML = name
    demoContainer.appendChild(button)
    button.classList.add("demo-button")

    button.onclick = () => {
      window.location.href = `https://three-demos.vercel.app/#${name}`
    }
  }
}

if (Object.keys(Demos).includes(window.location.hash.substring(1))) {
  params.demo = window.location.hash.substring(1)
  window.location.href = `https://three-demos.vercel.app/#${params.demo}`
} else {
  HomeDemo()
}
