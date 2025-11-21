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
  InputAdornment
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import RollerForm from '../components/RollerForm';

const STATUS_COLORS = {
  Pending: 'warning',
  Approved: 'success',
  Inactive: 'default',
  Rejected: 'error'
};

export default function RollerList() {
  const [rollers, setRollers] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [searchTerm, setSearchTerm] = useState(""); // Search state

  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'rollers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRollers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Function to handle Inline Approval
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

  const canAdd = userRole === 'Admin' || userRole === 'Editor';
  const canApprove = userRole === 'Admin' || userRole === 'Approver';

  // Search Logic
  const filteredRollers = rollers.filter(roller =>
    roller.rollerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    roller.line.toLowerCase().includes(searchTerm.toLowerCase()) ||
    roller.make.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>

      {/* --- UI FIX #1 & #3: Header & Search Alignment --- */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' }, // Stack on mobile, row on desktop
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
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
            width: { xs: '100%', sm: '300px' }, // Full width mobile, fixed on desktop
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px', // Rounded corners
              backgroundColor: 'white',
              borderRadius: '20px',
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

      <Grid container spacing={3}>
        {filteredRollers.map((roller) => (
          // --- UI FIX #2: Uniform Height (display="flex" on Grid Item) ---
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
              <CardContent sx={{ flexGrow: 1 }}> {/* flexGrow fills empty space */}
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

                {/* --- Logic for Approval Flow --- */}
                {/* Only show Check button if User is authorized AND status is Pending */}
                {canApprove && roller.status === 'Pending' && (
                  <Tooltip title="Approve Roller">
                    <IconButton
                      color="success"
                      sx={{ ml: 'auto' }} // Pushes button to the far right
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