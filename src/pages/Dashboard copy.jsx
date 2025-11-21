import React, { useState, useEffect } from 'react';
import { Box, Button, Chip, Container, Typography, Card, CardContent, CardActions, Grid, CircularProgress, IconButton , TextField} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
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

export default function Dashboard() {
  const [rollers, setRollers] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const { userRole } = useAuth();
  const navigate = useNavigate();
  // 1. Add this State
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, 'rollers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRollers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (data) => {
    setEditData(data);
    setOpenForm(true);
  };

  const handleClose = () => {
    setOpenForm(false);
    setEditData(null);
  };
  
  // 2. Update the filter logic just before the return
  const filteredRollers = rollers.filter(roller => 
    roller.rollerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    roller.line.toLowerCase().includes(searchTerm.toLowerCase()) || 
    roller.make.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Permission Check: Viewers can't add. Editors/Admins can.
  const canAdd = userRole === 'Admin' || userRole === 'Editor';

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          Roller Inventory
        </Typography>
      </Box>
      <TextField 
        fullWidth 
        variant="outlined" 
        placeholder="Search by Roller #, Make, or Line..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3, bgcolor: 'background.paper' }}
      />
      <Grid container spacing={3}>
        {filteredRollers.map((roller) => (
          <Grid item xs={12} sm={6} md={4} key={roller.id}>
            <Card elevation={2}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="h6">#{roller.rollerNumber}</Typography>
                  <Chip label={roller.status} color={STATUS_COLORS[roller.status]} size="small" />
                </Box>
                <Typography color="text.secondary">Make: {roller.make}</Typography>
                <Typography color="text.secondary">Design: {roller.design}</Typography>
                <Typography color="text.secondary">Pos: {roller.position} | Line: {roller.line}</Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end' }}>
                <Button 
                    size="small" 
                    startIcon={<VisibilityIcon />} 
                    onClick={() => navigate(`/roller/${roller.id}`)}
                >
                  View
                </Button>
                
                {/* Edit allowed if Admin or (Editor AND status is Pending) */}
                {(userRole === 'Admin' || (userRole === 'Editor' && roller.status === 'Pending')) && (
                  <Button size="small" color="primary" startIcon={<EditIcon />} onClick={() => handleEdit(roller)}>
                    Edit
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {canAdd && (
        <IconButton
          onClick={() => setOpenForm(true)}
          sx={{ position: 'fixed', bottom: 32, right: 32, bgcolor: 'primary.main', color: 'white', '&:hover':{bgcolor: 'primary.dark'} }}
          size="large"
        >
          <AddIcon fontSize="large" />
        </IconButton>
      )}

      <RollerForm open={openForm} onClose={handleClose} initialData={editData} />
    </Container>
  );
}