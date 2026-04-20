import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Tab,
  Tabs,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Button
} from '@mui/material';
import { 
  collectionGroup, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

// Icons
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RuleIcon from '@mui/icons-material/Rule';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function Approvals() {
  const [tabIndex, setTabIndex] = useState(0); // 0: Pending, 1: Rejected
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const status = tabIndex === 0 ? 'Pending' : 'Rejected';
      
      // Query specific status records across all rollers
      const q = query(
        collectionGroup(db, 'records'),
        where('status', '==', status),
        orderBy('date', 'desc') // Ensure indexing is done
      );
      
      const snapshot = await getDocs(q);
      
      const fetchedRecords = await Promise.all(snapshot.docs.map(async (recordDoc) => {
        const data = recordDoc.data();
        const rollerRef = recordDoc.ref.parent.parent;
        let rollerData = { rollerNumber: 'Unknown', line: '-' };
        
        if (rollerRef) {
          const rollerSnap = await getDoc(rollerRef);
          if (rollerSnap.exists()) {
            rollerData = rollerSnap.data();
          }
        }
        
        return {
            id: recordDoc.id,
            path: recordDoc.ref.path,
            rollerId: rollerRef.id,
            rollerNumber: rollerData.rollerNumber,
            line: rollerData.line,
            ...data
        };
      }));
      
      setRecords(fetchedRecords);
    } catch (error) {
      console.error("Error fetching approval records:", error);
      enqueueSnackbar("Failed to load records. Check console/indexes.", { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [tabIndex]);

  const handleAction = async (record, action) => {
    try {
      const isApprove = action === 'Approve';
      const newStatus = isApprove ? 'Approved' : 'Rejected';
      const recordRef = doc(db, record.path);
      
      await updateDoc(recordRef, {
        status: newStatus,
        approvedBy: auth.currentUser.uid, // Or rejectedBy if we had that field
        approvedAt: serverTimestamp(),
        approvalInfo: isApprove ? 'Approved via Dashboard' : 'Rejected via Dashboard' 
      });

      // If approving, update the parent roller's currentStatus
      if (isApprove) {
        try {
          const rollerRef = doc(db, 'rollers', record.rollerId);
          
          // Calculate the proper status from activity type
          if (record.activity !== 'Roller PDI') {
            let calculatedStatus = record.activity;
            if (record.activity === 'Roller Received') {
              // Check for ready_to_use field (case insensitive search)
              const allKeys = Object.keys(record);
              const readyToUseKey = allKeys.find(key => key.toLowerCase().includes('ready_to_use'));
              const readyValue = readyToUseKey ? record[readyToUseKey] : undefined;
              calculatedStatus = readyValue === 'Yes' ? 'Ready to Use' : 'To be sent';
            } else if (record.activity === 'Production Start') {
              calculatedStatus = 'Running';
            } else if (record.activity === 'Production End') {
              calculatedStatus = 'To be sent';
            } else if (record.activity === 'Roller sent') {
              calculatedStatus = 'Sent to Vendor';
            } else if (record.activity === 'Scrap') {
              calculatedStatus = 'Scrap';
            }

            await updateDoc(rollerRef, {
              currentStatus: calculatedStatus,
              lastUpdated: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error updating roller status:", error);
          // Don't fail the approval if roller update fails
        }
      }
      
      // Update local state to remove item instantly
      setRecords(prev => prev.filter(r => r.id !== record.id));
      
      enqueueSnackbar(`Record ${newStatus}`, { variant: isApprove ? 'success' : 'info' });
      
    } catch (error) {
      console.error("Error updating record:", error);
      enqueueSnackbar("Action failed", { variant: 'error' });
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  // Columns Configuration
  const columns = [
    { label: 'Roller #', align: 'left' },
    { label: 'Date', align: 'left' },
    { label: 'Activity', align: 'left' },
    { label: 'Status', align: 'center' },
    { label: 'Actions', align: 'center' }
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          variant="outlined"
          size="medium"
          sx={{ borderRadius: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
      <Box display="flex" alignItems="center" mb={3}>
        <RuleIcon color="action" sx={{ fontSize: 40, mr: 2 }} />
        <Typography variant="h4" fontWeight="bold" color="text.primary">
          Approvals Dashboard
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={tabIndex} 
          onChange={handleTabChange} 
          indicatorColor="primary" 
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: '#f9f9f9' }}
        >
          <Tab label="Pending Approval" sx={{ fontWeight: 'bold' }} />
          <Tab label="Rejected Records" sx={{ fontWeight: 'bold' }} />
        </Tabs>

        {loading ? (
          <Box display="flex" justifyContent="center" p={5}>
            <CircularProgress />
          </Box>
        ) : records.length === 0 ? (
          <Box p={5} textAlign="center">
            <Typography variant="h6" color="text.secondary">
              No {tabIndex === 0 ? 'pending' : 'rejected'} records found.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#eee' }}>
                <TableRow>
                   {columns.map((col) => (
                     <TableCell key={col.label} align={col.align} sx={{ fontWeight: 'bold' }}>
                       {col.label}
                     </TableCell>
                   ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Box display="flex" flexDirection="column">
                        <Typography 
                            variant="subtitle2" 
                            fontWeight="bold" 
                            color="primary" 
                            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => navigate(`/roller/${row.rollerId}`)}
                        >
                          #{row.rollerNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.line || 'No Line'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.date?.seconds ? format(new Date(row.date.seconds * 1000), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                        <Typography variant="body2">{row.activity}</Typography>
                        {row.remarks && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                "{row.remarks}"
                            </Typography>
                        )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={row.status} 
                        color={row.status === 'Pending' ? 'warning' : 'error'} 
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell align="center">
                      {tabIndex === 0 ? ( // Actions for Pending
                        <Box display="flex" justifyContent="center" gap={1}>
                          <Tooltip title="Approve">
                            <IconButton color="success" onClick={() => handleAction(row, 'Approve')}>
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton color="error" onClick={() => handleAction(row, 'Reject')}>
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Details">
                            <IconButton color="primary" onClick={() => navigate(`/roller/${row.rollerId}`)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : ( // Actions for Rejected
                        <Tooltip title="View Details">
                           <Button 
                             startIcon={<VisibilityIcon />} 
                             size="small" 
                             onClick={() => navigate(`/roller/${row.rollerId}`)}
                           >
                              View
                           </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}
