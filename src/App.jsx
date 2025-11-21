import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from './context/AuthContext';
import { theme } from './theme';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RollerList from './pages/RollerList';     // <-- The Renamed List Page
import RollerDetails from './pages/RollerDetails';
import Settings from './pages/Settings';
import ProtectedRoute from './components/AuthRoute';
import Layout from './components/Layout';
import { CssBaseline } from '@mui/material'; // <--- Import this

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* <--- Add this line here to reset browser styles perfectly */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <SnackbarProvider maxSnack={3}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/rollers" element={<RollerList />} />      {/* Inventory Page */}
                <Route path="/roller/:id" element={<RollerDetails />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
          </AuthProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;