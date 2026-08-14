import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Registro from './pages/Registro.jsx'
import Onboarding from './pages/Onboarding.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/onboarding" element={<Onboarding />} />
    </Routes>
  )
}

export default App
