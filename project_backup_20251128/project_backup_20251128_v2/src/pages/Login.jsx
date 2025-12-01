import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
// 1. Import Google Provider components
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../config/firebase'; // Ensure db is imported
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, TextField, Button, Paper, Alert, Divider, CircularProgress
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google'; // Ensure you have @mui/icons-material installed

const schema = yup.object().shape({
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' }
  });

  // Standard Email/Password Login
  const onSubmit = async (data) => {
    setLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      navigate('/'); 
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // OPTIONAL: Check if user exists in Firestore for Roles
      // If this is their first login, we can create a default "Viewer" entry for them
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        // Create default entry
        await setDoc(userDocRef, {
          email: user.email,
          role: 'Viewer', // Default role
          createdAt: new Date()
        });
      }

      navigate('/');
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error) => {
    console.error("Auth Error:", error);
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
      setAuthError('Invalid credentials.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      setAuthError('Sign-in cancelled.');
    } else {
      setAuthError('Authentication failed. Try again.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container component="main" maxWidth="xs">
        <Paper elevation={4} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 3 }}>
          
          <Typography component="h1" variant="h5" color="primary" fontWeight={700}>
            Roller System
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Sign in to manage inventory
          </Typography>

          {authError && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{authError}</Alert>}

          {/* 3. Google Button */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{ mb: 2, py: 1.5 }}
          >
            Sign in with Google
          </Button>

          <Divider sx={{ width: '100%', mb: 2 }}>OR</Divider>

          {/* Standard Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ width: '100%' }}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField {...field} margin="normal" fullWidth label="Email Address" error={!!errors.email} helperText={errors.email?.message} />
              )}
            />
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <TextField {...field} margin="normal" fullWidth label="Password" type="password" error={!!errors.password} helperText={errors.password?.message} />
              )}
            />

            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, py: 1.5 }} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Sign In With Email'}
            </Button>
          </Box>

        </Paper>
      </Container>
    </Box>
  );
}