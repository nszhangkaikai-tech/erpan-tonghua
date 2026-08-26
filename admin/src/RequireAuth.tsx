import { Navigate, Outlet } from 'react-router-dom';
import { isAuthed } from './auth';

export default function RequireAuth() {
  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
