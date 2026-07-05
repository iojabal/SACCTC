// Aplicacion SACCTC - Area Ventanilla (React + MUI + React Router)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import VentanillaHome from './pages/VentanillaHome';
import AfiliadosList from './pages/Afiliados/AfiliadosList';
import AfiliadoDetail from './pages/Afiliados/AfiliadoDetail';
import CambiosList from './pages/Cambios/CambiosList';
import CatosList from './pages/Catos/CatosList';
import CatoDetail from './pages/Catos/CatoDetail';
import ControlesList from './pages/Controles/ControlesList';
import RenovacionesHome from './pages/Renovaciones/RenovacionesHome';
import RenovacionesList from './pages/Renovaciones/RenovacionesList';
import RenovacionDetail from './pages/Renovaciones/RenovacionDetail';
import LegalHome from './pages/Legal/LegalHome';
import LegalList from './pages/Legal/LegalList';
import LegalDetail from './pages/Legal/LegalDetail';
import PlanosHome from './pages/Planos/PlanosHome';
import PlanosList from './pages/Planos/PlanosList';
import PlanosDetail from './pages/Planos/PlanosDetail';

const tema = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#2e7d32' },
  },
  components: {
    MuiTextField: { defaultProps: { autoComplete: 'off' } },
  },
});

/** Layout comun de las paginas autenticadas */
function ConLayout({ children }) {
  return (
    <ProtectedRoute>
      <Navbar />
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {children}
      </Container>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <NotificationProvider>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={<ConLayout><VentanillaHome /></ConLayout>} />

              <Route path="/afiliados"
                element={<ConLayout><AfiliadosList /></ConLayout>} />
              <Route path="/afiliados/:idAfi"
                element={<ConLayout><AfiliadoDetail /></ConLayout>} />

              <Route path="/cambios"
                element={<ConLayout><CambiosList /></ConLayout>} />

              <Route path="/catos"
                element={<ConLayout><CatosList /></ConLayout>} />
              <Route path="/catos/:idCato"
                element={<ConLayout><CatoDetail /></ConLayout>} />

              <Route path="/controles"
                element={<ConLayout><ControlesList /></ConLayout>} />

              <Route path="/renovaciones"
                element={<ConLayout><RenovacionesHome /></ConLayout>} />
              <Route path="/renovaciones/solicitudes"
                element={<ConLayout><RenovacionesList /></ConLayout>} />
              <Route path="/renovaciones/:idRenov"
                element={<ConLayout><RenovacionDetail /></ConLayout>} />

              <Route path="/legal"
                element={<ConLayout><LegalHome /></ConLayout>} />
              <Route path="/legal/casos"
                element={<ConLayout><LegalList /></ConLayout>} />
              <Route path="/legal/casos/:idCaso"
                element={<ConLayout><LegalDetail /></ConLayout>} />

              <Route path="/planos"
                element={<ConLayout><PlanosHome /></ConLayout>} />
              <Route path="/planos/lista"
                element={<ConLayout><PlanosList /></ConLayout>} />
              <Route path="/planos/:idPlano"
                element={<ConLayout><PlanosDetail /></ConLayout>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  );
}
