import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Registro from './pages/Registro.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import PanelLayout from './pages/panel/PanelLayout.jsx'
import PanelAgenda from './pages/panel/PanelAgenda.jsx'
import PanelHorarios from './pages/panel/PanelHorarios.jsx'
import PanelReportes from './pages/panel/PanelReportes.jsx'
import PanelServicios from './pages/panel/PanelServicios.jsx'
import PanelEstilistas from './pages/panel/PanelEstilistas.jsx'
import NegocioPublico from './pages/public/NegocioPublico.jsx'
import Reservar from './pages/public/Reservar.jsx'
import MiTurnoPlaceholder from './pages/public/MiTurnoPlaceholder.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/panel" element={<PanelLayout />}>
        <Route index element={<Navigate to="agenda" replace />} />
        <Route path="agenda" element={<PanelAgenda />} />
        <Route path="horarios" element={<PanelHorarios />} />
        <Route path="reportes" element={<PanelReportes />} />
        <Route path="servicios" element={<PanelServicios />} />
        <Route path="estilistas" element={<PanelEstilistas />} />
      </Route>

      {/* Rutas públicas por slug de negocio — van al final a propósito.
          negocio_slug_no_reservado (migración 00000000000004) evita que un
          slug real colisione con las rutas estáticas de arriba. */}
      <Route path="/:slug" element={<NegocioPublico />} />
      <Route path="/:slug/reservar" element={<Reservar />} />
      <Route path="/:slug/mi-turno" element={<MiTurnoPlaceholder />} />
    </Routes>
  )
}

export default App
