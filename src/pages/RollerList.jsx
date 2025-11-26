import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  InputAdornment,
  Alert,
  Skeleton,
  Fab
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearIcon from '@mui/icons-material/Clear';

import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RollerForm from '../components/RollerForm';

const STATUS_COLORS = {
  Pending: 'warning',
  Approved: 'success',
  Inactive: 'default',
  Rejected: 'error'
};

export default function RollerList() {
  const [rollers, setRollers] = useState([]);
  const [rollerStatuses, setRollerStatuses] = useState({}); // Store calculated statuses
  const [openForm, setOpenForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const { userRole } = useAuth();
  const navigate = useNavigate();

  // Get filter parameters from URL
  const lineFilter = searchParams.get('line');
  const positionFilter = searchParams.get('position');
  const statusFilter = searchParams.get('status');

  useEffect(() => {
    const q = query(collection(db, 'rollers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rollerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRollers(rollerData);

      // Fetch latest approved record for each roller to get current status in PARALLEL
      const statusPromises = rollerData.map(async (roller) => {
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

            return { id: roller.id, status: currentStatus };
          }
          return { id: roller.id, status: 'No Activity' };
        } catch (error) {
          console.error(`Error fetching records for roller ${roller.id}:`, error);
          return { id: roller.id, status: 'No Activity' };
        }
      });

      const results = await Promise.all(statusPromises);
      const statuses = {};
      results.forEach(r => {
        statuses[r.id] = r.status;
      });

      setRollerStatuses(statuses);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleApproveRoller = async (rollerId) => {
    if (!window.confirm("Are you sure you want to approve this roller?")) return;
    try {
      await updateDoc(doc(db, 'rollers', rollerId), {
        status: 'Approved'
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleEdit = (data) => {
    setEditData(data);
    setOpenForm(true);
  };

  const handleClose = () => {
    setOpenForm(false);
    setEditData(null);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const canAdd = userRole === 'Admin' || userRole === 'Editor';
  const canApprove = userRole === 'Admin' || userRole === 'Approver';

  // Enhanced Search and Filter Logic
  const filteredRollers = useMemo(() => {
    return rollers.filter(roller => {
      // Search term filter
      const matchesSearch =
        roller.rollerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        roller.line.toLowerCase().includes(searchTerm.toLowerCase()) ||
        roller.make.toLowerCase().includes(searchTerm.toLowerCase());

      // URL parameter filters
      let matchesLine = true;
      let matchesPosition = true;
      let matchesStatus = true;

      if (lineFilter) {
        // For SG#3, match both SG#3.1 and SG#3.2
        if (lineFilter === 'SG#3') {
          matchesLine = roller.line === 'SG#3.1' || roller.line === 'SG#3.2';
        } else {
          matchesLine = roller.line === lineFilter;
        }
      }

      if (positionFilter) {
        matchesPosition = roller.position === positionFilter;
      }

      if (statusFilter) {
        // Use calculated status from rollerStatuses state
        const rollerCurrentStatus = rollerStatuses[roller.id] || 'No Activity';
        matchesStatus = rollerCurrentStatus === statusFilter;
      }

      return matchesSearch && matchesLine && matchesPosition && matchesStatus;
    });
  }, [rollers, rollerStatuses, searchTerm, lineFilter, positionFilter, statusFilter]);

  const hasActiveFilters = lineFilter || positionFilter || statusFilter;

  const renderSkeletonCard = () => (
    <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex' }}>
      <Card elevation={2} sx={{ width: '100%', borderRadius: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Skeleton variant="text" width={100} height={32} />
            <Skeleton variant="rounded" width={70} height={24} />
          </Box>
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="90%" />
        </CardContent>
        <CardActions sx={{ p: 2, pt: 0 }}>
          <Skeleton variant="rounded" width={70} height={32} />
          <Skeleton variant="rounded" width={60} height={32} />
        </CardActions>
      </Card>
    </Grid>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4, position: 'relative', minHeight: '80vh' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          Roller Inventory
        </Typography>
      </Box>

      {/* Search and Filters - Simplified */}
      <Box mb={4}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by #, Make, Line..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            sx: { borderRadius: 3, bgcolor: 'white' }
          }}
        />
      </Box>

      {/* Active Filters Banner */}
      {hasActiveFilters && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={clearFilters} startIcon={<ClearIcon />}>
              CLEAR FILTERS
            </Button>
          }
        >
          Filters active:
          {lineFilter && ` Line: ${lineFilter}`}
          {positionFilter && ` | Position: ${positionFilter}`}
          {statusFilter && ` | Status: ${statusFilter}`}
        </Alert>
      )}

      {/* Roller Grid */}
      <Grid container spacing={3}>
        {loading ? (
          <>
            {renderSkeletonCard()}
            {renderSkeletonCard()}
            {renderSkeletonCard()}
            {renderSkeletonCard()}
            {renderSkeletonCard()}
            {renderSkeletonCard()}
          </>
        ) : filteredRollers.length > 0 ? (
          filteredRollers.map((roller) => (
            <Grid item xs={12} sm={6} md={4} key={roller.id} sx={{ display: 'flex' }}>
              <Card
                elevation={2}
                sx={{
                  width: '100%',
                  borderRadius: 3,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                  position: 'relative',
                  overflow: 'visible'
                }}
              >
                {/* Status Badge */}
                <Chip
                  label={roller.status}
                  color={STATUS_COLORS[roller.status] || 'default'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    fontWeight: 'bold',
                    boxShadow: 2
                  }}
                />

                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      #{roller.rollerNumber}
                    </Typography>
                  </Box>

                  <Box display="flex" flexDirection="column" gap={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Line:</strong> {roller.line}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Position:</strong> {roller.position}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Make:</strong> {roller.make}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Current Status:</strong> {rollerStatuses[roller.id] || 'No Activity'}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                  <Box>
                    <Tooltip title="View Details">
                      <IconButton
                        color="primary"
                        onClick={() => navigate(`/roller/${roller.id}`)}
                        sx={{ bgcolor: 'primary.light', color: 'primary.main', mr: 1, '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        color="secondary"
                        onClick={() => handleEdit(roller)}
                        sx={{ bgcolor: 'secondary.light', color: 'secondary.main', '&:hover': { bgcolor: 'secondary.main', color: 'white' } }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {canApprove && roller.status === 'Pending' && (
                    <Tooltip title="Approve">
                      <IconButton
                        color="success"
                        onClick={() => handleApproveRoller(roller.id)}
                        sx={{ bgcolor: 'success.light', color: 'success.main', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary">
                No rollers found matching your criteria.
              </Typography>
              <Button variant="outlined" sx={{ mt: 2 }} onClick={clearFilters}>
                Clear Filters
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Floating Action Button for Add New Roller */}
      {canAdd && (
        <Fab
          color="primary"
          aria-label="add"
          sx={{ position: 'fixed', bottom: 32, right: 32 }}
          onClick={() => setOpenForm(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Add/Edit Form Dialog */}
      <RollerForm
        open={openForm}
        handleClose={handleClose}
        editData={editData}
      />
    </Container>
  );
}