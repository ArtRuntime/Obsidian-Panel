import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ServerProvider } from './context/ServerContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/DashboardLayout';
import Overview from './pages/Overview';
import PrivateRoute from './components/PrivateRoute';
import Console from './pages/Console';
import RoleGuard from './components/RoleGuard';
import Files from './pages/Files';
import ServerSettings from './pages/ServerSettings';
import GeneralSettings from './pages/GeneralSettings';
import Backups from './pages/Backups';
import Plugins from './pages/Plugins';
import Users from './pages/Users';
import Schedules from './pages/Schedules';
import Templates from './pages/Templates';
import GameSettings from './pages/GameSettings';
import Players from './pages/Players';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ServerProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<PrivateRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Overview />} />

                  {/* Protected Routes */}
                  <Route element={<RoleGuard permission="console.view" />}>
                    <Route path="/console" element={<Console />} />
                  </Route>

                  <Route element={<RoleGuard permission="players.view" />}>
                    <Route path="/players" element={<Players />} />
                  </Route>

                  <Route element={<RoleGuard permission="files.view" />}>
                    <Route path="/files" element={<Files />} />
                  </Route>

                  <Route element={<RoleGuard permission="settings.edit" />}>
                    <Route path="/server-settings" element={<ServerSettings />} />
                  </Route>

                  <Route element={<RoleGuard permission="game.edit" />}>
                    <Route path="/game-settings" element={<GameSettings />} />
                  </Route>

                  <Route element={<RoleGuard permission="general.edit" />}>
                    <Route path="/general-settings" element={<GeneralSettings />} />
                  </Route>

                  <Route element={<RoleGuard permission="schedules.manage" />}>
                    <Route path="/schedules" element={<Schedules />} />
                  </Route>

                  <Route element={<RoleGuard permission="templates.manage" />}>
                    <Route path="/templates" element={<Templates />} />
                  </Route>

                  <Route element={<RoleGuard permission="backups.view" />}>
                    <Route path="/backups" element={<Backups />} />
                  </Route>

                  <Route element={<RoleGuard permission="plugins.view" />}>
                    <Route path="/plugins" element={<Plugins />} />
                  </Route>

                  <Route element={<RoleGuard permission="users.view" />}>
                    <Route path="/users" element={<Users />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </ServerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
export default App;
