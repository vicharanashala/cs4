import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import FAQPage from './components/FAQ/FAQPage';
import ForumPage from './components/Forum/ForumPage';
import PostDetail from './components/Forum/PostDetail';
import AdminPage from './components/Admin/AdminPage';

const ProtectedAdmin = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/"          element={<FAQPage />} />
          <Route path="/forum"     element={<ForumPage />} />
          <Route path="/forum/:postId" element={<PostDetail />} />
          <Route path="/admin"     element={<ProtectedAdmin><AdminPage /></ProtectedAdmin>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
