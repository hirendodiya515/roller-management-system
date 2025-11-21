import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Box,
  Grid,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CardActionArea
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import RecordForm from '../components/RecordForm';
import { format } from 'date-fns';

// Gradient Presets
const GRADIENTS = [
  'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)', // Blue
  'linear-gradient(135deg, #F761A1 0%, #8C1BAB 100%)', // Pink/Purple
  'linear-gradient(135deg, #43CBFF 0%, #9708CC 100%)', // Cyan/Purple
  'linear-gradient(135deg, #FCCF31 0%, #F55555 100%)', // Orange/Red
  'linear-gradient(135deg, #5EFCE8 0%, #736EFE 100%)', // Teal/Blue
  'linear-gradient(135deg, #81FBB8 0%, #28C76F 100%)', // Green
];

export default function RollerDetails() {
  const { id } = useParams();
  const [roller, setRoller] = useState(null);
  const [records, setRecords] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const { userRole, currentUser } = useAuth();

  const SYSTEM_FIELDS = ['rollerDiameter', 'runningLine', 'rollerRa', 'rollerRz', 'glassRa', 'glassRz', 'date', 'activity'];

  useEffect(() => {
    getDoc(doc(db, 'rollers', id)).then(d => setRoller(d.data()));

    const q = query(collection(db, `rollers/${id}/records`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const fetchConfigs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'formConfigs'));
        const allFieldsMap = new Map();
        querySnapshot.forEach((doc) => {
          const fields = doc.data().fields || [];
          fields.forEach(field => {
            if (!SYSTEM_FIELDS.includes(field.id) && !allFieldsMap.has(field.id)) {
              allFieldsMap.set(field.id, field);
            }
          });
        });
        setCustomFields(Array.from(allFieldsMap.values()));
      } catch (error) {
        console.error("Error fetching configs:", error);
      }
    };
    fetchConfigs();

    return () => unsub();
  }, [id]);

  const handleApproval = async (recordId, isApproved) => {
    if (userRole !== 'Approver' && userRole !== 'Admin') return;
    try {
      await updateDoc(doc(db, `rollers/${id}/records`, recordId), {
        status: isApproved ? 'Approved' : 'Rejected',
        approvedBy: currentUser.uid,
        approvedAt: new Date(),
        remarks: isApproved ? 'Approved via System' : 'Rejected'
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Calculate Activity Stats
  const activityStats = useMemo(() => {
    const stats = {};
    records.forEach(r => {
      if (r.activity) {
        if (!stats[r.activity]) {
          stats[r.activity] = { total: 0, approved: 0 };
        }
        stats[r.activity].total += 1;
        if (r.status === 'Approved') {
          stats[r.activity].approved += 1;
        }
      }
    });
    return Object.entries(stats).map(([name, data]) => ({ name, ...data }));
  }, [records]);

  // Filter Records
  const filteredRecords = useMemo(() => {
    if (!selectedActivity) return records;
    return records.filter(r => r.activity === selectedActivity);
  }, [records, selectedActivity]);

  if (!roller) return <Typography>Loading...</Typography>;

  const canAdd = ['Admin', 'Editor'].includes(userRole);

  return (
    <Container maxWidth="xl" sx={{ mt: 1 }}>

      {/* Top Section: Roller Info + Activity Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Main Info Card */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'white',
              borderRadius: 3,
              border: '1px solid #e0e0e0'
            }}
          >
            <Box>
              <Typography variant="h4" fontWeight="bold" color="primary.main">
                #{roller.rollerNumber}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {roller.make}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="body1" color="text.secondary" fontWeight="medium">
                {roller.design}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {roller.position}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Activity Summary Cards */}
        <Grid item xs={12} md={7} lg={8}>
          <Grid container spacing={2}>
            {activityStats.map((stat, index) => (
              <Grid item xs={6} sm={4} md={3} key={stat.name}>
                <Card
                  sx={{
                    borderRadius: 3,
                    background: GRADIENTS[index % GRADIENTS.length],
                    color: 'white',
                    boxShadow: '0 4px 15px 0 rgba(31, 38, 135, 0.15)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    transform: selectedActivity === stat.name ? 'scale(1.05)' : 'scale(1)',
                    border: selectedActivity === stat.name ? '2px solid white' : 'none',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px 0 rgba(31, 38, 135, 0.25)',
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => setSelectedActivity(selectedActivity === stat.name ? null : stat.name)}
                    sx={{ p: 1.5, height: '100%' }}
                  >
                    <Box display="flex" flexDirection="column" alignItems="flex-start">
                      <Typography variant="h4" fontWeight="bold" sx={{ opacity: 0.95 }}>
                        {stat.approved}/{stat.total}
                      </Typography>
                      <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.85, mt: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {stat.name}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">Service History</Typography>
          {selectedActivity && (
            <Chip
              icon={<FilterAltOffIcon />}
              label={`Filter: ${selectedActivity}`}
              onDelete={() => setSelectedActivity(null)}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>
        {canAdd && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenForm(true)}>
            Add Record
          </Button>
        )}
      </Box>

      <TableContainer
        component={Paper}
        sx={{
          overflowX: 'auto',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          '&::-webkit-scrollbar': { height: '8px' },
          '&::-webkit-scrollbar-track': { background: '#f1f1f1' },
          '&::-webkit-scrollbar-thumb': { background: '#1976d2', borderRadius: '4px' },
          '&::-webkit-scrollbar-thumb:hover': { background: '#1565c0' },
        }}
      >
        <Table sx={{ minWidth: 1000 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Actions</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Activity</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Diameter</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Run. Line</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Roller Ra/Rz</TableCell>
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>Glass Ra/Rz</TableCell>
              {customFields.map(field => (
                <TableCell key={field.id} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#495057' }}>
                  {field.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8 + customFields.length} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No records found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((row) => (
                <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>
                    <Chip
                      label={row.status}
                      color={row.status === 'Approved' ? 'success' : row.status === 'Rejected' ? 'error' : 'warning'}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {(userRole === 'Admin' || userRole === 'Approver') && row.status === 'Pending' && (
                      <>
                        <Tooltip title="Approve">
                          <IconButton size="small" color="success" onClick={() => handleApproval(row.id, true)}>
                            <CheckCircleIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton size="small" color="error" onClick={() => handleApproval(row.id, false)}>
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {(userRole === 'Admin' || (userRole === 'Editor' && row.status === 'Pending')) && (
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => { setRecordToEdit(row); setOpenForm(true); }}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.date?.seconds ? format(new Date(row.date.seconds * 1000), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.activity}</TableCell>
                  <TableCell>{row.rollerDiameter}</TableCell>
                  <TableCell>{row.runningLine}</TableCell>
                  <TableCell>{row.rollerRa} / {row.rollerRz}</TableCell>
                  <TableCell>{row.glassRa} / {row.glassRz}</TableCell>
                  {customFields.map(field => (
                    <TableCell key={field.id}>
                      {row[field.id] !== undefined && row[field.id] !== null ? String(row[field.id]) : '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <RecordForm
        open={openForm}
        onClose={() => { setOpenForm(false); setRecordToEdit(null); }}
        initialData={recordToEdit}
        rollerId={id}
      />
    </Container>
  );
}