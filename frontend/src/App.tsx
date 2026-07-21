import { useEffect, useState } from 'react'
import Landing from './Landing'
import Survey from './Survey'

function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return route.startsWith('#/survey') ? <Survey /> : <Landing />
}

export default App
