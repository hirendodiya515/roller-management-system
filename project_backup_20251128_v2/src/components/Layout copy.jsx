import { AppBar, Toolbar, Typography, Button, Box, Container, Avatar, Stack } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';

import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  AppBar, Toolbar, Typography, Box, Drawer, List, ListItem, Button, Container, Stack, 
  ListItemButton, ListItemIcon, ListItemText, IconButton, Avatar, Divider, CssBaseline 
} from '@mui/material';

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory'; // For Rollers
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';


export default function Layout() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top Navigation Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {/* Logo / App Name */}
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => navigate('/')}
          >
            Roller Management System
          </Typography>

          {/* User Info & Logout */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#fff' }}>
                {currentUser?.email}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, color: '#fff' }}>
                Role: {userRole || 'Loading...'}
              </Typography>
            </Box>
            
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
              {currentUser?.email?.charAt(0).toUpperCase()}
            </Avatar>

            <Button 
              color="inherit" 
              onClick={handleLogout} 
              startIcon={<LogoutIcon />}
              sx={{ ml: 1 }}
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content Area (Pages like Dashboard/Details render here) */}
      <Container component="main" maxWidth="lg" sx={{ flexGrow: 1, py: 4 }}>
        <Outlet /> 
      </Container>
      
      {/* Optional Footer */}
      <Box component="footer" sx={{ py: 2, textAlign: 'center', bgcolor: 'background.paper', mt: 'auto' }}>
        <Typography variant="body2" color="text.secondary">
          Roller Management System © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}