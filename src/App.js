import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/login';
import PanelLayout from './layouts/PanelLayout';
import DenetimlerPage from './pages/panel/denetimler';
import DenetimDetayPage from './pages/panel/denetim-detay';
import DenetimFormlariPage from './pages/panel/denetim-formlari';
import DenetimKategorilerPage from './pages/panel/denetim-kategoriler';
import AnalizPage from './pages/panel/analiz';
import DenetimAnalizPage from './pages/panel/denetim-analiz';
import SubeYonetimiPage from './pages/panel/sube-yonetimi';
import SubeDashboardPage from './pages/sube-panel/dashboard';
import SubeDenetimDetayPage from './pages/sube-panel/denetim-detay';
import SubeAnalizPage from './pages/sube-panel/analiz';
import SubeDenetimAnalizPage from './pages/sube-panel/denetim-analiz';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import DenetimYapPage from './pages/panel/denetim-yap';
import LinkYonetimiPage from './pages/panel/link-yonetimi';
import { Toaster } from 'react-hot-toast';

// Root yönlendirme bileşeni
function RootRedirect() {
  const { user, isAdmin } = useAuth();

  if (!user) return <Navigate to="/login" />;
  if (isAdmin) return <Navigate to="/panel" />;
  return <Navigate to="/sube-panel" />;
}

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Admin Panel Route'ları */}
          <Route
            path="/panel"
            element={
              <ProtectedRoute requireAdmin>
                <PanelLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DenetimlerPage />} />
            <Route path="denetim/:id" element={<DenetimDetayPage />} />
            <Route path="denetim-formlari" element={<DenetimFormlariPage />} />
            <Route path="link-yonetimi" element={<LinkYonetimiPage />} />
            <Route path="kategoriler" element={<DenetimKategorilerPage />} />
            <Route path="analiz" element={<AnalizPage />} />
            <Route path="denetim-analiz/:id" element={<DenetimAnalizPage />} />
            <Route path="sube-yonetimi" element={<SubeYonetimiPage />} />
          </Route>

          {/* Şube Panel Route'ları */}
          <Route
            path="/sube-panel"
            element={
              <ProtectedRoute requireBranch>
                <PanelLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SubeDashboardPage />} />
            <Route path="denetim-detay/:id" element={<SubeDenetimDetayPage />} />
            <Route path="analiz" element={<SubeAnalizPage />} />
            <Route path="denetim-analiz/:id" element={<SubeDenetimAnalizPage />} />
          </Route>

          {/* Denetim yapma sayfası - hem normal hem tek kullanımlık linkler için */}
          <Route path="/denetim-yap/:id" element={<DenetimYapPage />} />

          {/* 404 - Bulunamadı */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;