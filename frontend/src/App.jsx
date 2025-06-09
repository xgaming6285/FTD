import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { store, persistor } from './store/store';

// Import components
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import PublicRoute from './components/common/PublicRoute.jsx';
import MainLayout from './layouts/MainLayout.jsx';

// Import pages
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import PerformancePage from './pages/PerformancePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  return (
    <Provider store={store}>
      <PersistGate 
        loading={
          <Box 
            display="flex" 
            justifyContent="center" 
            alignItems="center" 
            minHeight="100vh"
          >
            <CircularProgress />
          </Box>
        } 
        persistor={persistor}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Routes>
              {/* Public routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                } 
              />

              {/* Protected routes with layout */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="leads" element={<LeadsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="performance" element={<PerformancePage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* 404 page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Router>
          
          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: {
                  primary: 'green',
                  secondary: 'black',
                },
              },
            }}
          />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

export default App; 