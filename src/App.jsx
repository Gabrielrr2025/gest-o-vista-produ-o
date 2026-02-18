import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Componente que redireciona para a primeira página permitida
const SmartRedirect = () => {
  const [redirectPath, setRedirectPath] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const user = await base44.auth.me();
        
        // Se é admin, vai para Dashboard
        if (user.role === 'admin') {
          setRedirectPath('/Dashboard');
          setIsChecking(false);
          return;
        }

        // Mapear páginas para permissões
        const pagePermissionMap = {
          'Dashboard': 'dashboard',
          'Products': 'products',
          'Planning': 'planning',
          'Calendar': 'calendar',
          'Reports': 'reports',
          'Settings': 'settings',
          'Admin': 'admin'
        };

        const permissions = user.permissions || {};

        // Ordem de prioridade das páginas
        const pageOrder = ['Products', 'Planning', 'Calendar', 'Dashboard', 'Reports', 'Settings'];

        // Encontrar primeira página permitida
        for (const page of pageOrder) {
          const permKey = pagePermissionMap[page];
          if (permissions[permKey]) {
            setRedirectPath(`/${page}`);
            setIsChecking(false);
            return;
          }
        }

        // Se não tem nenhuma permissão, vai para Products (padrão)
        setRedirectPath('/Products');
        setIsChecking(false);
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setRedirectPath('/Dashboard');
        setIsChecking(false);
      }
    };

    checkPermissions();
  }, []);

  if (isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return <Navigate to={redirectPath} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<SmartRedirect />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
