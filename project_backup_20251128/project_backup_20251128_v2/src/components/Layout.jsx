import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Box, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, IconButton, Avatar, Divider, CssBaseline
} from '@mui/material';

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory'; // For Rollers
import LogoutIcon from '@mui/icons-material/Logout';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SettingsIcon from '@mui/icons-material/Settings';

import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';

const drawerWidth = 260;

export default function Layout() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false); // Default closed for floating effect

  const toggleDrawer = () => {
    setOpen(!open);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Rollers', icon: <InventoryIcon />, path: '/rollers' },
    { text: 'Analysis', icon: <AssessmentIcon />, path: '/analysis' },
  ];

  if (userRole === 'Admin') {
    menuItems.push({ text: 'Settings', icon: <SettingsIcon />, path: '/settings' });
  }

  // Derive display name
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* Top Header */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={toggleDrawer} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h5" fontWeight="bold" noWrap component="div" sx={{ flexGrow: 1 }}>
            Roller Management System
          </Typography>

          <Box display="flex" alignItems="center" gap={2}>
            {/* User Info */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-end' }}>
              <Typography variant="body1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                {displayName}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {userRole}
              </Typography>
            </Box>

            {/* Profile Picture */}
            <Avatar
              src={currentUser?.photoURL}
              alt={displayName}
              sx={{ width: 40, height: 40, border: '2px solid white' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>

            {/* Logout */}
            <IconButton color="inherit" onClick={handleLogout} title="Logout">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Floating Sidebar Drawer */}
      <Drawer
        variant="temporary" // Makes it float over content
        open={open}
        onClose={toggleDrawer}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            top: '74px', // Push down below AppBar
            height: 'calc(100% - 90px)', // Adjust height
            left: '16px', // Floating offset
            borderRadius: '16px', // Rounded corners
            border: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.4)', // Translucent white (40%)
            backdropFilter: 'blur(12px)', // Frosted glass effect
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', // Soft shadow
            overflowX: 'hidden',
            '&::-webkit-scrollbar': { display: 'none' }, // Hide scrollbar
            scrollbarWidth: 'none', // Firefox
          },
        }}
      >
        <Box sx={{ overflow: 'auto', mt: 2, px: 2 }}>
          <List>
            {menuItems.map((item) => {
              const isSelected = location.pathname === item.path;
              return (
                <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 1 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      setOpen(false); // Close on selection
                    }}
                    selected={isSelected}
                    sx={{
                      minHeight: 48,
                      borderRadius: '12px',
                      justifyContent: 'initial',
                      px: 2.5,
                      transition: 'all 0.3s ease',
                      ...(isSelected && {
                        backgroundColor: '#1976d2 !important', // Blue background
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)', // Soft shadow for item
                        '& .MuiListItemIcon-root': {
                          color: 'white',
                        },
                        '& .MuiTypography-root': {
                          fontWeight: 'bold',
                        }
                      }),
                      '&:hover': {
                        backgroundColor: isSelected ? '#1565c0' : 'rgba(0, 0, 0, 0.04)',
                      }
                    }}
                  >
                    <ListItemIcon sx={{
                      minWidth: 0,
                      mr: 2,
                      justifyContent: 'center',
                      color: isSelected ? 'white' : 'inherit'
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isSelected ? 'bold' : 'medium' }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {/* Main Page Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: '100%' }}>
        <Toolbar /> {/* Spacing for TopBar */}
        <Outlet />
      </Box>
    </Box>
  );
}