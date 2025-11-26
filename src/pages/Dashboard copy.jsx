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
  Chip,
  Skeleton
} from '@mui/material';
import { collection, onSnapshot, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';

// Icons
import AnalyticsIcon from '@mui/icons-material/Analytics';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

const LINES = ['SG#1', 'SG#2', 'SG#3']; // Only 3 lines now

// Status colors matching RollerDetails
const STATUS_COLORS = {
  'Running': '#42A5F5',           // Light Blue
  'Under maintenance': '#FDD835', // Yellow
  'To be sent': '#FF9800',        // Orange
  'Ready to Use': '#66BB6A',      // Green
  'No Activity': '#9E9E9E'        // Grey
};

export default function Dashboard() {
  const [rollers, setRollers] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch all rollers and their latest approved records
  useEffect(() => {
    const unsubscribeRollers = onSnapshot(collection(db, 'rollers'), async (snapshot) => {
      const rollerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRollers(rollerData);

      // Fetch latest approved record for each roller to get current status
      const recordsData = {};
      for (const roller of rollerData) {
        try {
          const recordsQuery = query(
            collection(db, `rollers/${roller.id}/records`),
            orderBy('date', 'desc')
          );
          const recordsSnapshot = await getDocs(recordsQuery);
          const approvedRecords = recordsSnapshot.docs
            .map(doc => doc.data())
            .filter(r => r.status === 'Approved');

          if (approvedRecords.length > 0) {
            const latestRecord = approvedRecords[0];
            const activityType = latestRecord.activity;

            // Calculate current status using same logic as RollerDetails
            let currentStatus = 'No Activity';

            if (activityType === 'Roller Received') {
              const allKeys = Object.keys(latestRecord);
              const readyToUseKey = allKeys.find(key => key.toLowerCase().startsWith('ready_to_use'));
              const readyValue = readyToUseKey ? latestRecord[readyToUseKey] : undefined;

              currentStatus = readyValue === 'Yes' ? 'Ready to Use' : 'Under maintenance';
            } else if (activityType === 'Production Start') {
              currentStatus = 'Running';
            } else if (activityType === 'Production End') {
              currentStatus = 'To be sent';
            } else if (activityType === 'Roller sent') {
              currentStatus = 'Under maintenance';
            }

            recordsData[roller.id] = currentStatus;
          } else {
            recordsData[roller.id] = 'No Activity';
          }
        } catch (error) {
          console.error(`Error fetching records for roller ${roller.id}:`, error);
          recordsData[roller.id] = 'No Activity';
        }
      }

      setRecords(recordsData);
      setLoading(false);
    });

    return () => unsubscribeRollers();
  }, []);

  const handleStatusClick = (line, position, status) => {
    // Navigate to rollers page with filters
    navigate(`/rollers?line=${encodeURIComponent(line)}&position=${encodeURIComponent(position)}&status=${encodeURIComponent(status)}`);
  };

  const renderLineCard = (line, position) => {
    // Filter rollers for this line and position
    // For SG#3, include both SG#3.1 and SG#3.2
    let lineRollers;
    if (line === 'SG#3') {
      lineRollers = rollers.filter(r =>
        (r.line === 'SG#3.1' || r.line === 'SG#3.2') && r.position === position
      );
    } else {
      lineRollers = rollers.filter(r => r.line === line && r.position === position);
    }

    const totalRollers = lineRollers.length;

    // Count by status
    const statusCounts = {
      'Running': 0,
      'Under maintenance': 0,
      'To be sent': 0,
      'Ready to Use': 0
    };

    lineRollers.forEach(roller => {
      const status = records[roller.id] || 'No Activity';
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });

    return (
      <Grid item xs={12} sm={6} md={4} key={`${line}-${position}`}>
        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            height: '100%',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 6
            }
          }}
        >
          <CardContent sx={{ p: 1 }}>
            {/* Line Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="h6" fontWeight="bold" color="primary">
                {line}
              </Typography>
              <Chip
                label={`Total: ${totalRollers}`}
                size="small"
                color="default"
                sx={{ fontWeight: 'bold', height: 24 }}
              />
            </Box>

            {/* Status Stack - VERTICAL (Portrait) */}
            <Box display="flex" flexDirection="column" gap={1}>
              {Object.entries(statusCounts).map(([status, count]) => (
                <CardActionArea
                  key={status}
                  onClick={() => handleStatusClick(line, position, status)}
                  disabled={count === 0}
                  sx={{
                    borderRadius: 2,
                    p: 1.2,
                    bgcolor: count === 0 ? '#f5f5f5' : `${STATUS_COLORS[status]}15`,
                    border: `2px solid ${count === 0 ? '#e0e0e0' : STATUS_COLORS[status]}`,
                    transition: 'all 0.2s',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '48px', // Ensure minimum height for wrapped text
                    '&:hover': {
                      bgcolor: count === 0 ? '#f5f5f5' : `${STATUS_COLORS[status]}30`,
                      transform: count === 0 ? 'none' : 'scale(1.02)'
                    }
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: count === 0 ? '#9e9e9e' : 'text.primary',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      whiteSpace: 'normal', // Allow wrapping
                      wordBreak: 'break-word',
                      lineHeight: 1.2,
                      textAlign: 'left',
                      mr: 1,
                      flex: 1 // Allow text to take available space
                    }}
                  >
                    {status}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{
                      color: count === 0 ? '#9e9e9e' : STATUS_COLORS[status],
                      lineHeight: 1
                    }}
                  >
                    {count}
                  </Typography>
                </CardActionArea>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderSkeletonCard = () => (
    <Grid item xs={12} sm={6} md={4}>
      <Card elevation={2} sx={{ borderRadius: 3, minHeight: '280px' }}>
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
            <Skeleton variant="text" width={80} height={40} />
            <Skeleton variant="rounded" width={70} height={24} />
          </Box>
          <Box display="flex" flexDirection="column" gap={1.5}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={60} />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={4}>
        <AnalyticsIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
        <Typography variant="h4" fontWeight="bold" color="primary">
          Roller Stock Overview
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Top Rollers Section */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
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
            <Grid container spacing={2}>
              {loading ? (
                <>
                  {renderSkeletonCard()}
                  {renderSkeletonCard()}
                  {renderSkeletonCard()}
                </>
              ) : (
                LINES.map(line => renderLineCard(line, 'Top'))
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Bottom Rollers Section */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
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
            <Grid container spacing={2}>
              {loading ? (
                <>
                  {renderSkeletonCard()}
                  {renderSkeletonCard()}
                  {renderSkeletonCard()}
                </>
              ) : (
                LINES.map(line => renderLineCard(line, 'Bottom'))
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom>Recent System Activity</Typography>
        <Typography variant="body2" color="text.secondary">
          Future features: Graphs, alerts, and pending actions will appear here.
        </Typography>
      </Paper>
    </Box>
  );
}