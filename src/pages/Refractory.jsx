import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Button,
  Chip,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  InputAdornment,
  Alert,
  Skeleton,
  Fab,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FactoryIcon from '@mui/icons-material/Factory';
import CategoryIcon from '@mui/icons-material/Category';
import HistoryIcon from '@mui/icons-material/History';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NumbersIcon from '@mui/icons-material/Numbers';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import RefractoryForm from '../components/RefractoryForm';
import { useSnackbar } from 'notistack';

export default function Refractory() {
  // Authentication & Navigation
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  // Component States
  const [dropdowns, setDropdowns] = useState({ lines: [], refractoryTypes: [], furnaceTypes: [] });
  const [stocks, setStocks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("All");
  const [selectedLineFilter, setSelectedLineFilter] = useState("All");

  // Form Modal States
  const [openAddForm, setOpenAddForm] = useState(false);
  const [stockToEdit, setStockToEdit] = useState(null);
  
  // Delete Stock State
  const [stockToDelete, setStockToDelete] = useState(null);
  const [openDeleteStockDialog, setOpenDeleteStockDialog] = useState(false);

  // Use Stock Modal States
  const [openUseForm, setOpenUseForm] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [useQuantity, setUseQuantity] = useState(1);
  const [useRemarks, setUseRemarks] = useState("");
  const [submittingUse, setSubmittingUse] = useState(false);

  // Edit Usage Log State
  const [logToEdit, setLogToEdit] = useState(null);
  const [openEditLogModal, setOpenEditLogModal] = useState(false);
  const [editLogQty, setEditLogQty] = useState(1);
  const [editLogRemarks, setEditLogRemarks] = useState("");
  const [submittingEditLog, setSubmittingEditLog] = useState(false);

  // Delete Usage Log State
  const [logToDelete, setLogToDelete] = useState(null);
  const [openDeleteLogDialog, setOpenDeleteLogDialog] = useState(false);
  const [submittingDeleteLog, setSubmittingDeleteLog] = useState(false);

  // Rejection Logs & Modal States
  const [rejectionLogs, setRejectionLogs] = useState([]);
  const [openRejectForm, setOpenRejectForm] = useState(false);
  const [selectedStockForReject, setSelectedStockForReject] = useState(null);
  const [rejectQuantity, setRejectQuantity] = useState(1);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // Edit Rejection Log State (Admin)
  const [rejectLogToEdit, setRejectLogToEdit] = useState(null);
  const [openEditRejectModal, setOpenEditRejectModal] = useState(false);
  const [editRejectQty, setEditRejectQty] = useState(1);
  const [editRejectReason, setEditRejectReason] = useState("");
  const [editRejectRemarks, setEditRejectRemarks] = useState("");
  const [submittingEditRejectLog, setSubmittingEditRejectLog] = useState(false);

  // Delete Rejection Log State (Admin)
  const [rejectLogToDelete, setRejectLogToDelete] = useState(null);
  const [openDeleteRejectDialog, setOpenDeleteRejectDialog] = useState(false);
  const [submittingDeleteRejectLog, setSubmittingDeleteRejectLog] = useState(false);

  const canAdd = userRole === 'Admin' || userRole === 'Editor';
  const isAdmin = userRole === 'Admin';

  // Handler for Opening Add Stock Form
  const handleOpenAddForm = () => {
    setStockToEdit(null);
    setOpenAddForm(true);
  };

  // Handler for Opening Edit Stock Form
  const handleOpenEditForm = (stock) => {
    setStockToEdit(stock);
    setOpenAddForm(true);
  };

  // Handler for Confirming Delete Stock Batch
  const handleOpenDeleteStock = (stock) => {
    setStockToDelete(stock);
    setOpenDeleteStockDialog(true);
  };

  const handleConfirmDeleteStock = async () => {
    if (!stockToDelete) return;
    try {
      await deleteDoc(doc(db, 'refractories', stockToDelete.id));
      enqueueSnackbar('Refractory stock deleted successfully', { variant: 'success' });
      setOpenDeleteStockDialog(false);
      setStockToDelete(null);
    } catch (err) {
      console.error("Error deleting stock:", err);
      enqueueSnackbar("Failed to delete stock: " + err.message, { variant: 'error' });
    }
  };

  // Handlers for Usage Logs Edit & Delete
  const handleOpenEditLog = (log) => {
    setLogToEdit(log);
    setEditLogQty(log.unitsUsed || 1);
    setEditLogRemarks(log.remarks || "");
    setOpenEditLogModal(true);
  };

  const handleConfirmEditLog = async () => {
    if (!logToEdit) return;
    if (editLogQty <= 0) {
      enqueueSnackbar('Quantity used must be greater than 0', { variant: 'warning' });
      return;
    }
    setSubmittingEditLog(true);
    try {
      const oldQty = Number(logToEdit.unitsUsed || 0);
      const newQty = Number(editLogQty);
      const delta = oldQty - newQty; // positive if new Qty is less (restores stock), negative if new Qty is more

      // Update log entry
      await updateDoc(doc(db, 'refractoryLogs', logToEdit.id), {
        unitsUsed: newQty,
        remarks: editLogRemarks,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || 'Unknown'
      });

      // Adjust parent refractory batch if delta != 0
      if (delta !== 0 && logToEdit.refractoryId) {
        const stockRef = doc(db, 'refractories', logToEdit.refractoryId);
        const targetStock = stocks.find(s => s.id === logToEdit.refractoryId);
        if (targetStock) {
          const updatedUnits = Math.max(0, targetStock.units + delta);
          await updateDoc(stockRef, {
            units: updatedUnits,
            updatedAt: serverTimestamp()
          });
        }
      }

      enqueueSnackbar('Usage log updated successfully', { variant: 'success' });
      setOpenEditLogModal(false);
      setLogToEdit(null);
    } catch (err) {
      console.error("Error updating usage log:", err);
      enqueueSnackbar("Failed to update log: " + err.message, { variant: 'error' });
    } finally {
      setSubmittingEditLog(false);
    }
  };

  const handleOpenDeleteLog = (log) => {
    setLogToDelete(log);
    setOpenDeleteLogDialog(true);
  };

  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    setSubmittingDeleteLog(true);
    try {
      await deleteDoc(doc(db, 'refractoryLogs', logToDelete.id));

      // Restore units back to parent stock batch if exists
      if (logToDelete.refractoryId) {
        const targetStock = stocks.find(s => s.id === logToDelete.refractoryId);
        if (targetStock) {
          const restoredUnits = targetStock.units + Number(logToDelete.unitsUsed || 0);
          await updateDoc(doc(db, 'refractories', logToDelete.refractoryId), {
            units: restoredUnits,
            updatedAt: serverTimestamp()
          });
        }
      }

      enqueueSnackbar('Usage log deleted and stock restored', { variant: 'success' });
      setOpenDeleteLogDialog(false);
      setLogToDelete(null);
    } catch (err) {
      console.error("Error deleting log:", err);
      enqueueSnackbar("Failed to delete log: " + err.message, { variant: 'error' });
    } finally {
      setSubmittingDeleteLog(false);
    }
  };

  // 1. Fetch settings/dropdowns in real-time
  useEffect(() => {
    const docRef = doc(db, 'settings', 'dropdowns');
    const unsubscribeDropdowns = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDropdowns({
          lines: data.lines || ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2'],
          refractoryTypes: data.refractoryTypes || ['Lip block', 'Moving block', 'Overflow block', 'Flat arc'],
          furnaceTypes: data.furnaceTypes || ['Cross fired', 'End fired'],
          refractoryUnits: data.refractoryUnits || ['Set', 'Nos'],
          rejectionReasons: data.rejectionReasons || ['Cracked / Broken', 'Quality Defect', 'Dimensional Issue', 'Damaged in Transit', 'Installation Failure', 'Other']
        });
      }
    });
    return () => unsubscribeDropdowns();
  }, []);

  // 2. Fetch refractory stocks in real-time
  useEffect(() => {
    const q = query(collection(db, 'refractories'), orderBy('createdAt', 'desc'));
    const unsubscribeStocks = onSnapshot(q, (snapshot) => {
      const stockData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStocks(stockData);
      setLoading(false);
    }, (error) => {
      console.error("Error loading stocks:", error);
      setLoading(false);
    });
    return () => unsubscribeStocks();
  }, []);

  // 3. Fetch refractory usage logs in real-time
  useEffect(() => {
    const q = query(collection(db, 'refractoryLogs'), orderBy('usedAt', 'desc'));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logData);
    }, (error) => {
      console.error("Error loading usage logs:", error);
    });
    return () => unsubscribeLogs();
  }, []);

  // 3.2 Fetch refractory rejection logs in real-time
  useEffect(() => {
    const q = query(collection(db, 'refractoryRejections'), orderBy('rejectedAt', 'desc'));
    const unsubscribeRejections = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRejectionLogs(logData);
    }, (error) => {
      console.error("Error loading rejection logs:", error);
    });
    return () => unsubscribeRejections();
  }, []);

  // 3.5 Sort lines naturally (e.g. SG#1, SG#2, SG#3.1, SG#3.2)
  const sortedLines = useMemo(() => {
    return [...dropdowns.lines].sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [dropdowns.lines]);

  // 4. Calculate Furnace-Type Wise & Line Dedication Summary Matrix with Unit Breakdown (Sets vs Nos)
  const furnaceSummary = useMemo(() => {
    const categories = ['End fired', 'Cross fired', 'Common'];
    const types = dropdowns.refractoryTypes || ['Lip block', 'Moving block', 'Overflow block', 'Flat arc'];
    
    const summary = {
      'End fired': { title: 'End Fired Furnace', subtitle: 'SG#1 & SG#2', sets: 0, nos: 0, items: {} },
      'Cross fired': { title: 'Cross Fired Furnace', subtitle: 'SG#3 (SG#3.1 & SG#3.2)', sets: 0, nos: 0, items: {} },
      'Common': { title: 'Common / Shared Stock', subtitle: 'General Spares', sets: 0, nos: 0, items: {} }
    };

    categories.forEach(cat => {
      types.forEach(t => {
        summary[cat].items[t] = {
          sets: 0,
          nos: 0,
          lines: {}
        };
      });
    });

    stocks.forEach(stock => {
      const qty = Number(stock.units || 0);
      if (qty <= 0) return;

      let cat = 'Common';
      const line = stock.line || '';
      const furnaceType = stock.furnaceType || '';

      if (furnaceType === 'End fired' || ['SG#1', 'SG#2'].includes(line)) {
        cat = 'End fired';
      } else if (furnaceType === 'Cross fired' || ['SG#3', 'SG#3.1', 'SG#3.2'].includes(line)) {
        cat = 'Cross fired';
      }

      const isSet = (stock.unit || '').toLowerCase().includes('set');
      const unitKey = isSet ? 'sets' : 'nos';
      const typeName = stock.type || 'Other';

      if (!summary[cat].items[typeName]) {
        summary[cat].items[typeName] = { sets: 0, nos: 0, lines: {} };
      }

      summary[cat][unitKey] += qty;
      summary[cat].items[typeName][unitKey] += qty;

      let lineLabel = line;
      if (cat === 'Cross fired') {
        // All Cross Fired stock maps directly to SG#3 (no Shared in Cross Fired)
        lineLabel = 'SG#3';
      } else if (cat === 'End fired') {
        // For End Fired, if line is not explicitly SG#1 or SG#2, it is Shared
        if (line !== 'SG#1' && line !== 'SG#2') {
          lineLabel = 'Shared';
        }
      } else {
        lineLabel = line || 'Shared';
      }

      if (!summary[cat].items[typeName].lines[lineLabel]) {
        summary[cat].items[typeName].lines[lineLabel] = { sets: 0, nos: 0 };
      }
      summary[cat].items[typeName].lines[lineLabel][unitKey] += qty;
    });

    return summary;
  }, [stocks, dropdowns]);

  // 5. Filter Active Stock List
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const matchesSearch =
        (stock.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.line || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.furnaceType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.materialCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.unit || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stock.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedTypeFilter === "All" || stock.type === selectedTypeFilter;

      let matchesLine = true;
      if (selectedLineFilter === "All") {
        matchesLine = true;
      } else if (selectedLineFilter === "End Fired") {
        matchesLine = stock.furnaceType === "End fired" || stock.line === "SG#1" || stock.line === "SG#2";
      } else if (selectedLineFilter === "Cross Fired") {
        matchesLine = stock.furnaceType === "Cross fired" || stock.line === "SG#3" || stock.line === "SG#3.1" || stock.line === "SG#3.2";
      } else if (selectedLineFilter === "SG#1") {
        matchesLine = stock.line === "SG#1";
      } else if (selectedLineFilter === "SG#2") {
        matchesLine = stock.line === "SG#2";
      } else if (selectedLineFilter === "SG#3") {
        matchesLine = stock.line === "SG#3" || stock.line === "SG#3.1" || stock.line === "SG#3.2";
      } else if (selectedLineFilter === "Common") {
        matchesLine = !stock.line || stock.line === "Common" || stock.line === "Unassigned";
      } else {
        matchesLine = stock.line === selectedLineFilter;
      }

      // Only display items that have stock remaining
      return matchesSearch && matchesType && matchesLine && stock.units > 0;
    });
  }, [stocks, searchTerm, selectedTypeFilter, selectedLineFilter]);

  // 6. Action: Open Consume Stock Dialog
  const handleOpenUseForm = (stock) => {
    setSelectedStock(stock);
    setUseQuantity(1);
    setUseRemarks("");
    setOpenUseForm(true);
  };

  // 7. Action: Submit Consume Stock Request
  const handleConfirmUse = async () => {
    if (!selectedStock) return;
    if (useQuantity <= 0 || useQuantity > selectedStock.units) {
      enqueueSnackbar(`Please select a quantity between 1 and ${selectedStock.units}`, { variant: 'warning' });
      return;
    }

    setSubmittingUse(true);
    try {
      const stockRef = doc(db, 'refractories', selectedStock.id);
      const newQuantity = selectedStock.units - Number(useQuantity);

      // Decrement the stock count
      await updateDoc(stockRef, {
        units: newQuantity,
        updatedAt: serverTimestamp()
      });

      // Write to Usage Logs
      await addDoc(collection(db, 'refractoryLogs'), {
        refractoryId: selectedStock.id,
        type: selectedStock.type,
        line: selectedStock.line,
        unitsUsed: Number(useQuantity),
        supplierName: selectedStock.supplierName,
        usedBy: currentUser?.email || 'Unknown',
        usedAt: serverTimestamp(),
        remarks: useRemarks
      });

      enqueueSnackbar(`Used ${useQuantity} units of ${selectedStock.type} successfully`, { variant: 'success' });
      setOpenUseForm(false);
      setSelectedStock(null);
    } catch (error) {
      console.error("Error updating stock quantity:", error);
      enqueueSnackbar("Error consumed stock: " + error.message, { variant: 'error' });
    } finally {
      setSubmittingUse(false);
    }
  };

  // 8. Action: Handlers for Rejection
  const handleOpenRejectForm = (stock) => {
    setSelectedStockForReject(stock);
    setRejectQuantity(1);
    const defaultReasons = dropdowns.rejectionReasons || ['Cracked / Broken', 'Quality Defect', 'Dimensional Issue', 'Damaged in Transit', 'Installation Failure', 'Other'];
    setRejectReason(defaultReasons[0] || 'Cracked / Broken');
    setRejectRemarks("");
    setOpenRejectForm(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedStockForReject) return;
    if (rejectQuantity <= 0 || rejectQuantity > selectedStockForReject.units) {
      enqueueSnackbar(`Please enter a quantity between 1 and ${selectedStockForReject.units}`, { variant: 'warning' });
      return;
    }
    if (!rejectReason) {
      enqueueSnackbar('Please select a rejection reason', { variant: 'warning' });
      return;
    }

    setSubmittingReject(true);
    try {
      const stockRef = doc(db, 'refractories', selectedStockForReject.id);
      const newUnits = selectedStockForReject.units - Number(rejectQuantity);
      const currentRejected = Number(selectedStockForReject.rejectedUnits || 0);

      // Decrement stock count and update cumulative rejected units
      await updateDoc(stockRef, {
        units: newUnits,
        rejectedUnits: currentRejected + Number(rejectQuantity),
        updatedAt: serverTimestamp()
      });

      const userDisplayName = currentUser?.displayName 
        ? `${currentUser.displayName} (${currentUser.email})` 
        : currentUser?.email || 'Unknown User';

      // Write to Rejection Logs
      await addDoc(collection(db, 'refractoryRejections'), {
        refractoryId: selectedStockForReject.id,
        type: selectedStockForReject.type,
        line: selectedStockForReject.line || 'Unassigned',
        furnaceType: selectedStockForReject.furnaceType || '',
        unitsRejected: Number(rejectQuantity),
        unit: selectedStockForReject.unit || 'Set',
        reason: rejectReason,
        supplierName: selectedStockForReject.supplierName || 'N/A',
        rejectedBy: userDisplayName,
        rejectedAt: serverTimestamp(),
        remarks: rejectRemarks
      });

      enqueueSnackbar(`Recorded rejection of ${rejectQuantity} ${selectedStockForReject.unit || 'units'} of ${selectedStockForReject.type}`, { variant: 'error' });
      setOpenRejectForm(false);
      setSelectedStockForReject(null);
    } catch (error) {
      console.error("Error submitting rejection:", error);
      enqueueSnackbar("Failed to record rejection: " + error.message, { variant: 'error' });
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleOpenEditRejectLog = (log) => {
    setRejectLogToEdit(log);
    setEditRejectQty(log.unitsRejected || 1);
    setEditRejectReason(log.reason || (dropdowns.rejectionReasons?.[0] || 'Cracked / Broken'));
    setEditRejectRemarks(log.remarks || "");
    setOpenEditRejectModal(true);
  };

  const handleConfirmEditRejectLog = async () => {
    if (!rejectLogToEdit) return;
    if (editRejectQty <= 0) {
      enqueueSnackbar('Quantity rejected must be greater than 0', { variant: 'warning' });
      return;
    }
    setSubmittingEditRejectLog(true);
    try {
      const oldQty = Number(rejectLogToEdit.unitsRejected || 0);
      const newQty = Number(editRejectQty);
      const delta = oldQty - newQty; // positive if new Qty is less (restores stock), negative if new Qty is more

      // Update rejection log entry
      await updateDoc(doc(db, 'refractoryRejections', rejectLogToEdit.id), {
        unitsRejected: newQty,
        reason: editRejectReason,
        remarks: editRejectRemarks,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || 'Unknown'
      });

      // Adjust parent refractory batch if delta != 0
      if (delta !== 0 && rejectLogToEdit.refractoryId) {
        const stockRef = doc(db, 'refractories', rejectLogToEdit.refractoryId);
        const targetStock = stocks.find(s => s.id === rejectLogToEdit.refractoryId);
        if (targetStock) {
          const updatedUnits = Math.max(0, targetStock.units + delta);
          const updatedRejected = Math.max(0, (targetStock.rejectedUnits || 0) - delta);
          await updateDoc(stockRef, {
            units: updatedUnits,
            rejectedUnits: updatedRejected,
            updatedAt: serverTimestamp()
          });
        }
      }

      enqueueSnackbar('Rejection log updated successfully', { variant: 'success' });
      setOpenEditRejectModal(false);
      setRejectLogToEdit(null);
    } catch (err) {
      console.error("Error updating rejection log:", err);
      enqueueSnackbar("Failed to update rejection log: " + err.message, { variant: 'error' });
    } finally {
      setSubmittingEditRejectLog(false);
    }
  };

  const handleOpenDeleteRejectLog = (log) => {
    setRejectLogToDelete(log);
    setOpenDeleteRejectDialog(true);
  };

  const handleConfirmDeleteRejectLog = async () => {
    if (!rejectLogToDelete) return;
    setSubmittingDeleteRejectLog(true);
    try {
      await deleteDoc(doc(db, 'refractoryRejections', rejectLogToDelete.id));

      // Restore units back to parent stock batch if exists
      if (rejectLogToDelete.refractoryId) {
        const targetStock = stocks.find(s => s.id === rejectLogToDelete.refractoryId);
        if (targetStock) {
          const restoredUnits = targetStock.units + Number(rejectLogToDelete.unitsRejected || 0);
          const newRejectedCount = Math.max(0, (targetStock.rejectedUnits || 0) - Number(rejectLogToDelete.unitsRejected || 0));
          await updateDoc(doc(db, 'refractories', rejectLogToDelete.refractoryId), {
            units: restoredUnits,
            rejectedUnits: newRejectedCount,
            updatedAt: serverTimestamp()
          });
        }
      }

      enqueueSnackbar('Rejection log deleted and stock restored', { variant: 'success' });
      setOpenDeleteRejectDialog(false);
      setRejectLogToDelete(null);
    } catch (err) {
      console.error("Error deleting rejection log:", err);
      enqueueSnackbar("Failed to delete log: " + err.message, { variant: 'error' });
    } finally {
      setSubmittingDeleteRejectLog(false);
    }
  };

  // Status Styling Helper
  const getStockStatus = (count) => {
    if (count === 0) return { label: 'Out of Stock', color: 'error', bg: '#ffebee' };
    if (count <= 5) return { label: 'Low Stock', color: 'warning', bg: '#fff3e0' };
    return { label: 'In Stock', color: 'success', bg: '#e8f5e9' };
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4, position: 'relative', minHeight: '80vh' }}>
      {/* Back to Dashboard Button */}
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

      {/* Page Title */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
            Refractory Stock Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage refractory inventory, monitor stock levels per line, and track usage logs.
          </Typography>
        </Box>
      </Box>

      {/* Section 1: Modern Furnace-Type Wise Summary */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocalFireDepartmentIcon color="primary" /> Furnace-Type Stock Status
      </Typography>

      {loading ? (
        <Box
          display="flex"
          flexDirection={{ xs: 'column', md: 'row' }}
          flexWrap="wrap"
          gap={3}
          mb={5}
          width="100%"
        >
          {[1, 2, 3].map(idx => (
            <Skeleton
              key={idx}
              animation="wave"
              variant="rounded"
              height={220}
              sx={{
                borderRadius: 3,
                flex: { xs: '1 1 100%', md: '1 1 calc(33.33% - 16px)' }
              }}
            />
          ))}
        </Box>
      ) : (
        <Box
          display="flex"
          flexDirection={{ xs: 'column', md: 'row' }}
          flexWrap="wrap"
          gap={3}
          mb={5}
          width="100%"
        >
          {['End fired', 'Cross fired', 'Common'].map(cat => {
            const catData = furnaceSummary[cat];
            const sets = catData?.sets || 0;
            const nos = catData?.nos || 0;

            let totalLabel = "0 Total";
            if (sets > 0 && nos > 0) totalLabel = `${sets} Sets | ${nos} Nos`;
            else if (sets > 0) totalLabel = `${sets} ${sets === 1 ? 'Set' : 'Sets'}`;
            else if (nos > 0) totalLabel = `${nos} ${nos === 1 ? 'No' : 'Nos'}`;

            const isZero = sets === 0 && nos === 0;

            return (
              <Card
                key={cat}
                elevation={3}
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(33.33% - 16px)' },
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%)',
                  border: '1px solid #e3edf7',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 20px rgba(0,0,0,0.08)'
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  {/* Header */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ lineHeight: 1.2 }}>
                        {catData.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight="medium">
                        {catData.subtitle}
                      </Typography>
                    </Box>
                    <Chip
                      label={totalLabel}
                      color={isZero ? "default" : "primary"}
                      size="small"
                      sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                    />
                  </Box>

                  {/* Stock Details per Refractory Type */}
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    {dropdowns.refractoryTypes.map(type => {
                      const itemData = catData.items[type] || { sets: 0, nos: 0, lines: {} };
                      const itemSets = itemData.sets;
                      const itemNos = itemData.nos;
                      const itemTotal = itemSets + itemNos;

                      const status = getStockStatus(itemTotal);

                      // Helper to render Sets | Nos pair in a strict 3-column Grid for perfect vertical column alignment
                      const renderSetsAndNosPair = (sCount, nCount, isHeaderRow = false) => {
                        const isSetZero = sCount === 0;
                        const isNosZero = nCount === 0;

                        return (
                          <Box
                            display="inline-grid"
                            gridTemplateColumns="60px 14px 60px"
                            alignItems="center"
                            sx={{ minWidth: 134 }}
                          >
                            <Typography
                              variant="caption"
                              align="right"
                              sx={{
                                fontWeight: 'bold',
                                color: isSetZero ? '#b0bec5' : 'text.primary',
                                fontSize: isHeaderRow ? '0.85rem' : '0.75rem'
                              }}
                            >
                              {sCount} {sCount === 1 ? 'Set' : 'Sets'}
                            </Typography>
                            <Typography
                              variant="caption"
                              align="center"
                              sx={{
                                color: '#cfd8dc',
                                fontWeight: 'bold',
                                fontSize: isHeaderRow ? '0.85rem' : '0.75rem'
                              }}
                            >
                              |
                            </Typography>
                            <Typography
                              variant="caption"
                              align="right"
                              sx={{
                                fontWeight: 'bold',
                                color: isNosZero ? '#b0bec5' : 'text.primary',
                                fontSize: isHeaderRow ? '0.85rem' : '0.75rem'
                              }}
                            >
                              {nCount} {nCount === 1 ? 'No' : 'Nos'}
                            </Typography>
                          </Box>
                        );
                      };

                      // Lines to display for this item
                      let linesToRender = [];
                      if (cat === 'End fired') {
                        linesToRender = ['SG#1', 'SG#2'];
                        if (itemData.lines['Shared'] && (itemData.lines['Shared'].sets > 0 || itemData.lines['Shared'].nos > 0)) {
                          linesToRender.push('Shared');
                        }
                      } else if (cat === 'Cross fired') {
                        linesToRender = ['SG#3'];
                      } else {
                        linesToRender = Object.keys(itemData.lines).filter(l => (itemData.lines[l].sets > 0 || itemData.lines[l].nos > 0));
                        if (linesToRender.length === 0) linesToRender = ['Shared'];
                      }

                      return (
                        <Box key={type} sx={{ pb: 1, borderBottom: '1px dashed #edeef2', '&:last-child': { borderBottom: 0, pb: 0 } }}>
                          {/* Item Main Row */}
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: `${status.color}.main`,
                                  flexShrink: 0
                                }}
                              />
                              <Typography variant="body2" fontWeight="bold" color="text.primary" sx={{ lineHeight: 1.2 }}>
                                {type}
                              </Typography>
                            </Box>
                            {renderSetsAndNosPair(itemSets, itemNos, true)}
                          </Box>

                          {/* Sub-Rows for Line Breakdown */}
                          {itemTotal > 0 && linesToRender.length > 0 && (
                            <Stack spacing={0.5} sx={{ pl: 2, mt: 0.5, borderLeft: '2px solid #e0e0e0' }}>
                              {linesToRender.map(lineKey => {
                                const lData = itemData.lines[lineKey] || { sets: 0, nos: 0 };
                                const lSets = lData.sets || 0;
                                const lNos = lData.nos || 0;
                                const isShared = lineKey === 'Shared' || lineKey === 'Common' || !lineKey;

                                return (
                                  <Box key={lineKey} display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography
                                      variant="caption"
                                      fontWeight="bold"
                                      color={isShared ? "text.secondary" : lineKey.includes('1') ? "info.main" : lineKey.includes('2') ? "success.main" : "warning.main"}
                                    >
                                      {isShared ? 'Shared:' : `${lineKey}:`}
                                    </Typography>
                                    {renderSetsAndNosPair(lSets, lNos, false)}
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Section 2: Active Inventory Stock Batches */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryIcon color="primary" /> Active Stock Batches
        </Typography>
      </Box>

      {/* Filter and Search Bar */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: '#fafafa' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3.5}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Search by Supplier, Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm("")}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { borderRadius: 2, bgcolor: 'white' }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <TextField
              select
              fullWidth
              size="small"
              label="Filter by Type"
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              SelectProps={{
                sx: { borderRadius: 2, bgcolor: 'white' }
              }}
            >
              <MenuItem value="All">All Types</MenuItem>
              {dropdowns.refractoryTypes.map(t => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={8} md={6}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ minWidth: 'fit-content' }}>
                Filter:
              </Typography>
              <ToggleButtonGroup
                value={selectedLineFilter}
                exclusive
                onChange={(e, newLine) => {
                  if (newLine !== null) {
                    setSelectedLineFilter(newLine);
                  }
                }}
                size="small"
                color="primary"
                sx={{
                  bgcolor: 'white',
                  width: '100%',
                  display: 'flex',
                  borderRadius: 2,
                  flexWrap: 'wrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    textTransform: 'none',
                    fontWeight: 'bold',
                    border: '1px solid #e0e0e0',
                    py: 0.75,
                    px: 1,
                    color: 'text.secondary',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'white',
                      borderColor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      }
                    }
                  }
                }}
              >
                <ToggleButton value="All"> All </ToggleButton>
                <ToggleButton value="End Fired"> End Fired </ToggleButton>
                <ToggleButton value="Cross Fired"> Cross Fired </ToggleButton>
                <ToggleButton value="SG#1"> SG#1 </ToggleButton>
                <ToggleButton value="SG#2"> SG#2 </ToggleButton>
                <ToggleButton value="SG#3"> SG#3 </ToggleButton>
                <ToggleButton value="Common"> Common </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>

          {(searchTerm || selectedTypeFilter !== "All" || selectedLineFilter !== "All") && (
            <Grid item xs={12} md={1}>
              <Button
                fullWidth
                variant="text"
                color="secondary"
                startIcon={<ClearIcon />}
                onClick={() => {
                  setSearchTerm("");
                  setSelectedTypeFilter("All");
                  setSelectedLineFilter("All");
                }}
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              >
                Clear
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Active Stock Cards List */}
      {loading ? (
        <Stack spacing={2} mb={5}>
          <Skeleton animation="wave" variant="rounded" height={60} />
          <Skeleton animation="wave" variant="rounded" height={60} />
          <Skeleton animation="wave" variant="rounded" height={60} />
        </Stack>
      ) : filteredStocks.length > 0 ? (
        <Stack spacing={2} mb={5} sx={{ width: '100%' }}>
          {filteredStocks.map((stock) => {
            const status = getStockStatus(stock.units);
            const percentRemaining = (stock.units / stock.initialUnits) * 100;

            return (
              <Card
                key={stock.id}
                variant="outlined"
                sx={{
                  width: '100%',
                  borderRadius: 3,
                  borderColor: '#e0e0e0',
                  transition: 'box-shadow 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                  }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box
                    display="flex"
                    flexDirection={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                    gap={2}
                    width="100%"
                  >
                    {/* Column 1: Type, Supplier, Material Code & Description */}
                    <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">
                        {stock.type}
                      </Typography>
                      {stock.materialCode && (
                        <Typography variant="caption" color="primary.main" fontWeight="bold" display="block">
                          Code: {stock.materialCode}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        Supplier: <strong>{stock.supplierName || 'N/A'}</strong>
                      </Typography>
                      {stock.description && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                          "{stock.description}"
                        </Typography>
                      )}
                    </Box>

                    {/* Column 2: Furnace Type & Line Chips */}
                    <Box sx={{ width: { xs: 'auto', md: '20%' }, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {stock.furnaceType && (
                        <Chip
                          icon={<LocalFireDepartmentIcon color="error" />}
                          label={stock.furnaceType}
                          variant="outlined"
                          size="small"
                          color="warning"
                          sx={{ borderRadius: 1.5, fontWeight: 'bold' }}
                        />
                      )}
                      <Chip
                        icon={<FactoryIcon />}
                        label={stock.line || 'Unassigned'}
                        variant="outlined"
                        size="small"
                        sx={{ borderRadius: 1.5 }}
                      />
                    </Box>

                    {/* Column 3: Units / Progress */}
                    <Box sx={{ width: { xs: '100%', md: '20%' } }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {stock.units} / {stock.initialUnits} {stock.unit || 'Units'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(percentRemaining)}% Left
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentRemaining}
                        color={percentRemaining <= 20 ? "error" : percentRemaining <= 50 ? "warning" : "success"}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>

                    {/* Column 4: Added Date */}
                    <Box sx={{ width: { xs: 'auto', md: '15%' } }}>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Added:
                      </Typography>
                      <Typography variant="body2">
                        {stock.createdAt?.seconds
                          ? format(new Date(stock.createdAt.seconds * 1000), 'dd MMM yyyy')
                          : 'Just now'}
                      </Typography>
                    </Box>

                    {/* Column 5: Actions (Use / Edit / Delete) */}
                    <Box sx={{ width: { xs: '100%', md: '25%' }, display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', gap: 1 }}>
                      {canAdd && (
                        <>
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            startIcon={<RemoveCircleOutlineIcon />}
                            onClick={() => handleOpenUseForm(stock)}
                            sx={{ borderRadius: 2 }}
                          >
                            Use Stock
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<ReportProblemIcon />}
                            onClick={() => handleOpenRejectForm(stock)}
                            sx={{ borderRadius: 2, fontWeight: 'bold' }}
                          >
                            Reject Stock
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <Tooltip title="Edit Batch (Admin Only)">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEditForm(stock)}
                              sx={{ bgcolor: '#e3f2fd', '&:hover': { bgcolor: '#bbdefb' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Batch (Admin Only)">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleOpenDeleteStock(stock)}
                              sx={{ bgcolor: '#ffebee', '&:hover': { bgcolor: '#ffcdd2' } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Box textAlign="center" py={5} mb={5} bgcolor="#fdfdfd" borderRadius={3} border="1px dashed #ccc">
          <Typography variant="body1" color="text.secondary">
            No active refractory stocks found. Click the FAB button to add stock.
          </Typography>
        </Box>
      )}

      {/* Section 2.5: Stock Addition Logs (Collapsible Accordion) */}
      <Accordion sx={{ borderRadius: 3, border: '1px solid #e0e0e0', mb: 2, boxShadow: 'none', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon color="primary" /> Stock Addition Logs
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 3, pb: 3 }}>
          {stocks.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell><strong>Date & Time</strong></TableCell>
                    <TableCell><strong>Material Code</strong></TableCell>
                    <TableCell><strong>Refractory Type</strong></TableCell>
                    <TableCell><strong>Furnace Type</strong></TableCell>
                    <TableCell><strong>Line</strong></TableCell>
                    <TableCell align="right"><strong>Qty Added</strong></TableCell>
                    <TableCell align="right"><strong>Remaining</strong></TableCell>
                    <TableCell><strong>Supplier</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>Added By</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    {isAdmin && <TableCell align="center"><strong>Actions (Admin)</strong></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stocks.map((stock) => (
                    <TableRow key={stock.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>
                        {stock.createdAt?.seconds
                          ? format(new Date(stock.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm')
                          : 'Just now'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {stock.materialCode || '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {stock.type}
                      </TableCell>
                      <TableCell>
                        {stock.furnaceType ? (
                          <Chip label={stock.furnaceType} size="small" color="warning" variant="outlined" />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip label={stock.line || 'Unassigned'} size="small" sx={{ borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        +{stock.initialUnits} {stock.unit || ''}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {stock.units} {stock.unit || ''}
                      </TableCell>
                      <TableCell>{stock.supplierName || '-'}</TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        {stock.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <AccountCircleIcon fontSize="inherit" color="action" />
                          <Typography variant="body2">{stock.createdBy?.split('@')[0]}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={stock.units > 0 ? 'Active' : 'Consumed'}
                          color={stock.units > 0 ? 'success' : 'default'}
                          size="small"
                          variant={stock.units > 0 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Edit Stock (Admin)">
                              <IconButton size="small" color="primary" onClick={() => handleOpenEditForm(stock)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Stock (Admin)">
                              <IconButton size="small" color="error" onClick={() => handleOpenDeleteStock(stock)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" py={2}>
              No stock additions have been recorded yet.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Section 3: Usage History & Transaction Logs (Collapsible Accordion) */}
      <Accordion sx={{ borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: 'none', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" /> Recent Stock Usage Logs
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 3, pb: 3 }}>
          {logs.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell><strong>Date & Time</strong></TableCell>
                    <TableCell><strong>Refractory Type</strong></TableCell>
                    <TableCell><strong>Line</strong></TableCell>
                    <TableCell align="right"><strong>Qty Used</strong></TableCell>
                    <TableCell><strong>Supplier Batch</strong></TableCell>
                    <TableCell><strong>User</strong></TableCell>
                    <TableCell><strong>Remarks / Purpose</strong></TableCell>
                    {isAdmin && <TableCell align="center"><strong>Actions (Admin)</strong></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>
                        {log.usedAt?.seconds
                          ? format(new Date(log.usedAt.seconds * 1000), 'dd/MM/yyyy HH:mm')
                          : 'Just now'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {log.type}
                      </TableCell>
                      <TableCell>
                        <Chip label={log.line} size="small" sx={{ borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        -{log.unitsUsed}
                      </TableCell>
                      <TableCell>{log.supplierName}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <AccountCircleIcon fontSize="inherit" color="action" />
                          <Typography variant="body2">{log.usedBy?.split('@')[0]}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        {log.remarks || '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Edit Usage Log (Admin)">
                              <IconButton size="small" color="primary" onClick={() => handleOpenEditLog(log)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Usage Log (Admin)">
                              <IconButton size="small" color="error" onClick={() => handleOpenDeleteLog(log)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" py={2}>
              No stock usage has been logged yet.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Section 4: Rejection History & Transaction Logs (Collapsible Accordion) */}
      <Accordion sx={{ borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: 'none', '&:before': { display: 'none' }, mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <ReportProblemIcon color="error" /> Recent Stock Rejection Logs
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 3, pb: 3 }}>
          {rejectionLogs.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fff5f5' }}>
                  <TableRow>
                    <TableCell><strong>Date & Time</strong></TableCell>
                    <TableCell><strong>Refractory Type</strong></TableCell>
                    <TableCell><strong>Line</strong></TableCell>
                    <TableCell align="right"><strong>Qty Rejected</strong></TableCell>
                    <TableCell><strong>Rejection Reason</strong></TableCell>
                    <TableCell><strong>Supplier Batch</strong></TableCell>
                    <TableCell><strong>Recorded By</strong></TableCell>
                    <TableCell><strong>Remarks / Details</strong></TableCell>
                    {isAdmin && <TableCell align="center"><strong>Actions (Admin)</strong></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rejectionLogs.map((log) => (
                    <TableRow key={log.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>
                        {log.rejectedAt?.seconds
                          ? format(new Date(log.rejectedAt.seconds * 1000), 'dd/MM/yyyy HH:mm')
                          : 'Just now'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {log.type}
                      </TableCell>
                      <TableCell>
                        <Chip label={log.line || 'Unassigned'} size="small" sx={{ borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        -{log.unitsRejected} {log.unit || ''}
                      </TableCell>
                      <TableCell>
                        <Chip label={log.reason} color="error" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
                      </TableCell>
                      <TableCell>{log.supplierName || '-'}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <AccountCircleIcon fontSize="inherit" color="action" />
                          <Typography variant="body2">{log.rejectedBy?.split('@')[0] || log.rejectedBy}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                        {log.remarks || '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Edit Rejection Log (Admin)">
                              <IconButton size="small" color="primary" onClick={() => handleOpenEditRejectLog(log)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Rejection Log (Admin)">
                              <IconButton size="small" color="error" onClick={() => handleOpenDeleteRejectLog(log)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" py={2}>
              No stock rejections have been recorded yet.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Floating Action Button to Add New Refractory */}
      {canAdd && (
        <Fab
          color="primary"
          aria-label="add stock"
          sx={{ position: 'fixed', bottom: 32, right: 32, boxShadow: 4 }}
          onClick={handleOpenAddForm}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Dialog Form for Adding / Editing Stock */}
      <RefractoryForm
        open={openAddForm}
        onClose={() => {
          setOpenAddForm(false);
          setStockToEdit(null);
        }}
        dropdowns={dropdowns}
        editData={stockToEdit}
      />

      {/* Dialog for Consuming Stock (Use Stock) */}
      <Dialog
        open={openUseForm}
        onClose={() => setOpenUseForm(false)}
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Use Refractory Stock
          <IconButton onClick={() => setOpenUseForm(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {selectedStock && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="warning">
                You are consuming stock of <strong>{selectedStock.type}</strong> on <strong>{selectedStock.line}</strong> from <strong>{selectedStock.supplierName}</strong> batch.
              </Alert>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Current Available Stock:</Typography>
                <Typography variant="body2" fontWeight="bold">{selectedStock.units} units</Typography>
              </Box>

              <TextField
                type="number"
                label="Quantity to Consume (Units)"
                fullWidth
                value={useQuantity}
                onChange={(e) => setUseQuantity(Math.min(selectedStock.units, Math.max(1, Number(e.target.value))))}
                helperText={`Maximum available units: ${selectedStock.units}`}
                InputProps={{
                  inputProps: { min: 1, max: selectedStock.units },
                  startAdornment: (
                    <InputAdornment position="start">
                      <NumbersIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Remarks / Usage Details"
                fullWidth
                multiline
                rows={2}
                placeholder="e.g. Changed due to wear and tear"
                value={useRemarks}
                onChange={(e) => setUseRemarks(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#f9f9f9', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button onClick={() => setOpenUseForm(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmUse}
            variant="contained"
            color="warning"
            disabled={submittingUse}
            sx={{ borderRadius: 2 }}
          >
            Confirm Consumption
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Admin Delete Stock Confirmation */}
      <Dialog
        open={openDeleteStockDialog}
        onClose={() => setOpenDeleteStockDialog(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          Confirm Delete Stock Batch (Admin)
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {stockToDelete && (
            <Typography variant="body1">
              Are you sure you want to permanently delete stock batch for <strong>{stockToDelete.type}</strong> ({stockToDelete.line || 'Unassigned'})? This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDeleteStockDialog(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDeleteStock} variant="contained" color="error">
            Delete Stock
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Admin Edit Usage Log */}
      <Dialog
        open={openEditLogModal}
        onClose={() => setOpenEditLogModal(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Edit Stock Usage Log (Admin)
          <IconButton onClick={() => setOpenEditLogModal(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {logToEdit && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="info">
                Editing usage log for <strong>{logToEdit.type}</strong> on <strong>{logToEdit.line}</strong> ({logToEdit.supplierName}).
              </Alert>

              <TextField
                type="number"
                label="Quantity Used (Units)"
                fullWidth
                value={editLogQty}
                onChange={(e) => setEditLogQty(Math.max(1, Number(e.target.value)))}
                InputProps={{
                  inputProps: { min: 1 },
                  startAdornment: (
                    <InputAdornment position="start">
                      <NumbersIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Remarks / Purpose"
                fullWidth
                multiline
                rows={2}
                value={editLogRemarks}
                onChange={(e) => setEditLogRemarks(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: '#f9f9f9' }}>
          <Button onClick={() => setOpenEditLogModal(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmEditLog}
            variant="contained"
            color="primary"
            disabled={submittingEditLog}
          >
            Update Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Admin Delete Usage Log Confirmation */}
      <Dialog
        open={openDeleteLogDialog}
        onClose={() => setOpenDeleteLogDialog(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          Confirm Delete Usage Log (Admin)
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {logToDelete && (
            <Typography variant="body1">
              Are you sure you want to delete this usage log entry of <strong>{logToDelete.unitsUsed} units</strong> for <strong>{logToDelete.type}</strong>? Deleting this log will restore <strong>{logToDelete.unitsUsed} units</strong> back to the stock batch.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDeleteLogDialog(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteLog}
            variant="contained"
            color="error"
            disabled={submittingDeleteLog}
          >
            Delete & Restore Stock
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Recording Stock Rejection */}
      <Dialog
        open={openRejectForm}
        onClose={() => setOpenRejectForm(false)}
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <ReportProblemIcon />
            <span>Record Refractory Rejection</span>
          </Box>
          <IconButton onClick={() => setOpenRejectForm(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {selectedStockForReject && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="error" icon={<ReportProblemIcon />}>
                Recording rejection for <strong>{selectedStockForReject.type}</strong> ({selectedStockForReject.line || 'Unassigned'}) from <strong>{selectedStockForReject.supplierName || 'N/A'}</strong> batch. The rejected quantity will be deducted from available stock.
              </Alert>

              <Box display="flex" justifyContent="space-between" p={1.5} bgcolor="#fff5f5" borderRadius={2} border="1px solid #ffe3e3">
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Recorded By:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.dark">
                    {currentUser?.displayName ? `${currentUser.displayName} (${currentUser.email})` : currentUser?.email || 'Unknown User'}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary" display="block">Available Stock:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="text.primary">
                    {selectedStockForReject.units} {selectedStockForReject.unit || 'units'}
                  </Typography>
                </Box>
              </Box>

              <TextField
                type="number"
                label="Quantity Rejected *"
                fullWidth
                value={rejectQuantity}
                onChange={(e) => setRejectQuantity(Math.min(selectedStockForReject.units, Math.max(1, Number(e.target.value))))}
                helperText={`Maximum available to reject: ${selectedStockForReject.units} ${selectedStockForReject.unit || 'units'}`}
                InputProps={{
                  inputProps: { min: 1, max: selectedStockForReject.units },
                  startAdornment: (
                    <InputAdornment position="start">
                      <NumbersIcon color="error" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                select
                label="Rejection Reason *"
                fullWidth
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                {(dropdowns.rejectionReasons || ['Cracked / Broken', 'Quality Defect', 'Dimensional Issue', 'Damaged in Transit', 'Installation Failure', 'Other']).map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Remarks / Rejection Details"
                fullWidth
                multiline
                rows={2.5}
                placeholder="Describe the issue, defect details, or condition..."
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#fcfcfc', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button onClick={() => setOpenRejectForm(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmReject}
            variant="contained"
            color="error"
            disabled={submittingReject}
            sx={{ borderRadius: 2, fontWeight: 'bold' }}
          >
            Confirm Rejection & Deduct Stock
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Admin Edit Rejection Log */}
      <Dialog
        open={openEditRejectModal}
        onClose={() => setOpenEditRejectModal(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Edit Stock Rejection Log (Admin)
          <IconButton onClick={() => setOpenEditRejectModal(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {rejectLogToEdit && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="info">
                Editing rejection log for <strong>{rejectLogToEdit.type}</strong> on <strong>{rejectLogToEdit.line}</strong> ({rejectLogToEdit.supplierName}).
              </Alert>

              <TextField
                type="number"
                label="Quantity Rejected (Units)"
                fullWidth
                value={editRejectQty}
                onChange={(e) => setEditRejectQty(Math.max(1, Number(e.target.value)))}
                InputProps={{
                  inputProps: { min: 1 },
                  startAdornment: (
                    <InputAdornment position="start">
                      <NumbersIcon color="error" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                select
                label="Rejection Reason"
                fullWidth
                value={editRejectReason}
                onChange={(e) => setEditRejectReason(e.target.value)}
              >
                {(dropdowns.rejectionReasons || ['Cracked / Broken', 'Quality Defect', 'Dimensional Issue', 'Damaged in Transit', 'Installation Failure', 'Other']).map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Remarks / Details"
                fullWidth
                multiline
                rows={2}
                value={editRejectRemarks}
                onChange={(e) => setEditRejectRemarks(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: '#f9f9f9' }}>
          <Button onClick={() => setOpenEditRejectModal(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmEditRejectLog}
            variant="contained"
            color="error"
            disabled={submittingEditRejectLog}
          >
            Update Rejection Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Admin Delete Rejection Log Confirmation */}
      <Dialog
        open={openDeleteRejectDialog}
        onClose={() => setOpenDeleteRejectDialog(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          Confirm Delete Rejection Log (Admin)
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {rejectLogToDelete && (
            <Typography variant="body1">
              Are you sure you want to delete this rejection log entry of <strong>{rejectLogToDelete.unitsRejected} units</strong> for <strong>{rejectLogToDelete.type}</strong>? Deleting this log will restore <strong>{rejectLogToDelete.unitsRejected} units</strong> back to available stock.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDeleteRejectDialog(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteRejectLog}
            variant="contained"
            color="error"
            disabled={submittingDeleteRejectLog}
          >
            Delete & Restore Stock
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}