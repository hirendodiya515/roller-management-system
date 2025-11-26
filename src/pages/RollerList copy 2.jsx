import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearIcon from '@mui/icons-material/Clear';

import { collection, onSnapshot, query, orderBy as firestoreOrderBy, doc, updateDoc, getDocs } from 'firebase/firestore';
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
  const [rollerStatuses, setRollerStatuses] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const { userRole } = useAuth();
  const navigate = useNavigate();

  // Get filter parameters from URL
  const lineFilter = searchParams.get('line');
  const positionFilter = searchParams.get('position');
  const statusFilter = searchParams.get('status');

  useEffect(() => {
    const q = query(collection(db, 'rollers'), firestoreOrderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rollerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRollers(rollerData);

      // Fetch current status for each roller
      const statusData = {};
      for (const roller of rollerData) {
        try {
          const recordsQuery = query(
            collection(db, `rollers/${roller.id}/records`),
            firestoreOrderBy('date', 'desc')
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

            statusData[roller.id] = currentStatus;
          } else {
            statusData[roller.id] = 'No Activity';
          }
        } catch (error) {
          console.error(`Error fetching records for roller ${roller.id}:`, error);
          statusData[roller.id] = 'No Activity';
        }
      }

      setRollerStatuses(statusData);
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
  const filteredRollers = rollers.filter(roller => {
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
      const rollerCurrentStatus = rollerStatuses[roller.id] || 'No Activity';
      matchesStatus = rollerCurrentStatus === statusFilter;
    }

    return matchesSearch && matchesLine && matchesPosition && matchesStatus;
  });

  const hasActiveFilters = lineFilter || positionFilter || statusFilter;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      {/* Header & Search */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          gap: 2
        }}
      >
        <Typography variant="h4" fontWeight="bold" color="primary">
          Roller Inventory
        </Typography>

        <TextField
          variant="outlined"
          size="small"
          placeholder="Search by #, Make, Line..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            width: { xs: '100%', sm: '300px' },
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px',
              backgroundColor: 'white',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Active Filters Alert */}
      {hasActiveFilters && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={clearFilters} startIcon={<ClearIcon />}>
              Clear Filters
            </Button>
          }
        >
          Filters active:
          {lineFilter && ` Line: ${lineFilter}`}
          {positionFilter && ` | Position: ${positionFilter}`}
          {statusFilter && ` | Status: ${statusFilter}`}
        </Alert>
      )}

      {/* Roller Cards */}
      <Grid container spacing={3}>
        {filteredRollers.map((roller) => (
          <Grid item xs={12} sm={6} md={4} key={roller.id} sx={{ display: 'flex' }}>
            <Card
              elevation={2}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 3,
                transition: '0.3s',
                '&:hover': { boxShadow: 6 }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Typography variant="h6" fontWeight="bold">#{roller.rollerNumber}</Typography>
                  <Chip
                    label={roller.status}
                    color={STATUS_COLORS[roller.status] || 'default'}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Make:</strong> {roller.make}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Design:</strong> {roller.design}
                </Typography>
                {roller.activityType && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Type:</strong> {roller.activityType}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  <strong>Loc:</strong> {roller.position} | <strong>Line:</strong> {roller.line}
                </Typography>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VisibilityIcon />}
                  onClick={() => navigate(`/roller/${roller.id}`)}
                >
                  View
                </Button>

                {(userRole === 'Admin' || (userRole === 'Editor' && roller.status === 'Pending')) && (
                  <Button size="small" color="primary" startIcon={<EditIcon />} onClick={() => handleEdit(roller)}>
                    Edit
                  </Button>
                )}

                {canApprove && roller.status === 'Pending' && (
                  <Tooltip title="Approve Roller">
                    <IconButton
                      color="success"
                      sx={{ ml: 'auto' }}
                      onClick={() => handleApproveRoller(roller.id)}
                    >
                      <CheckCircleIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add Button */}
      {canAdd && (
        <IconButton
          onClick={() => setOpenForm(true)}
          sx={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            bgcolor: 'primary.main',
            color: 'white',
            boxShadow: 4,
            '&:hover': { bgcolor: 'primary.dark' }
          }}
          size="large"
        >
          <AddIcon fontSize="large" />
        </IconButton>
      )}

      <RollerForm open={openForm} onClose={handleClose} initialData={editData} />
    </Container>
  );
}