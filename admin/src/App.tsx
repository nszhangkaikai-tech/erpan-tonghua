import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import AdminLayout from './layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admins from './pages/Admins';
import Users from './pages/Users';
import Stories from './pages/Stories';
import VoiceClones from './pages/VoiceClones';
import Cdkeys from './pages/Cdkeys';
import Templates from './pages/Templates';
import TemplatesCreate from './pages/TemplatesCreate';
import SafetyConfig from './pages/SafetyConfig';
import Notifications from './pages/Notifications';
import AiConfig from './pages/AiConfig';
import ThemeConfig from './pages/ThemeConfig';
import Authors from './pages/Authors';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="admins" element={<Admins />} />
            <Route path="users" element={<Users />} />
            <Route path="stories" element={<Stories />} />
            <Route path="voice" element={<VoiceClones />} />
            <Route path="cdkeys" element={<Cdkeys />} />
            <Route path="templates" element={<Templates />} />
            <Route path="templates/create" element={<TemplatesCreate />} />
            <Route path="templates/edit/:id" element={<TemplatesCreate />} />
            <Route path="safety" element={<SafetyConfig />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="theme-config" element={<ThemeConfig />} />
            <Route path="authors" element={<Authors />} />
            <Route path="ai-config" element={<AiConfig />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
