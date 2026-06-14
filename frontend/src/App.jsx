import { Navigate, Route, Routes } from "react-router-dom";
import { Gift } from "lucide-react";
import { useAuth } from "./context/AuthContext.jsx";
import CreateFamily from "./pages/CreateFamily.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

function ProtectedRoute({ children }) {
  const { currentUser, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-50 text-ink">
        <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-5 py-4 shadow-soft">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-moss border-t-transparent" />
          טוען את הקופה המשפחתית
        </div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }) {
  const { currentUser, initializing } = useAuth();

  if (initializing) {
    return null;
  }

  return currentUser ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/create-family"
        element={
          <PublicOnlyRoute>
            <CreateFamily />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <main className="grid min-h-screen place-items-center bg-stone-50 p-6 text-ink">
            <div className="text-center">
              <Gift className="mx-auto mb-4 h-10 w-10 text-moss" />
              <h1 className="text-2xl font-semibold">העמוד לא נמצא</h1>
              <Navigate to="/" replace />
            </div>
          </main>
        }
      />
    </Routes>
  );
}
