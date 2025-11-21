import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Paper,
  CardActionArea,
  Divider
} from '@mui/material';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';

// Icon
import AnalyticsIcon from '@mui/icons-material/Analytics';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

const LINES = ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2'];

export default function Dashboard() {
  const [rollers, setRollers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch all data real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rollers'), (snapshot) => {
      const rollerData = snapshot.docs.map(doc => doc.data());
      setRollers(rollerData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

  const getCardStyles = (activeCount) => {
    if (activeCount === 0) {
      return {
        background: 'linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)', // Red
        color: '#b71c1c'
      };
    }
    if (activeCount === 1) {
      return {
        background: 'linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%)', // Orange
        color: '#e65100'
      };
    }
    return {
      background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)', // Default
      color: 'text.primary'
    };
  };

  const renderRollerCards = (position) => (
    <Grid container spacing={2}>
      {LINES.map((line) => {
        // Filter by Line and Position
        const lineRollers = rollers.filter(r => r.line === line && r.position === position);
        const totalRollers = lineRollers.length;

        // Active Logic: status is 'Roller Received' (case insensitive)
        const activeRollers = lineRollers.filter(r =>
          r.currentStatus && r.currentStatus.trim().toLowerCase() === 'roller received'
        ).length;

        const styles = getCardStyles(activeRollers);

        return (
          <Grid item xs={6} key={line}>
            <Card
              elevation={3}
              sx={{
                borderRadius: 4,
                textAlign: 'center',
                background: styles.background,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 },
                height: '100%'
              }}
            >
              <CardActionArea onClick={() => navigate('/rollers')} sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ color: styles.color, opacity: 0.8, fontWeight: 'bold' }} gutterBottom>
                    {line}
                  </Typography>
                  <Box sx={{ my: 1 }}>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: styles.color }}>
                      {activeRollers} <Typography component="span" variant="h6" sx={{ color: styles.color, opacity: 0.7 }}>/ {totalRollers}</Typography>
                    </Typography>
                    <Typography variant="caption" sx={{ color: styles.color, opacity: 0.8 }}>
                      Active / Total
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={4}>
        <AnalyticsIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
        <Typography variant="h4" fontWeight="bold" color="primary">
          Plant Overview
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Top Rollers Column */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              border: '1px solid rgba(0, 0, 0, 0.05)'
            }}
          >
            <Box display="flex" alignItems="center" mb={3}>
              <VerticalAlignTopIcon color="primary" />
              <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ ml: 1 }}>
                Top Rollers
              </Typography>
            </Box>
            {renderRollerCards('Top')}
          </Paper>
        </Grid>

        {/* Bottom Rollers Column */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              border: '1px solid rgba(0, 0, 0, 0.05)'
            }}
          >
            <Box display="flex" alignItems="center" mb={3}>
              <VerticalAlignBottomIcon color="primary" />
              <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ ml: 1 }}>
                Bottom Rollers
              </Typography>
            </Box>
            {renderRollerCards('Bottom')}
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom>Recent System Activity</Typography>
        <Typography variant="body2" color="text.secondary">Future features: Graphs, alerts, and pending actions will appear here.</Typography>
      </Paper>
    </Box>
  );
}