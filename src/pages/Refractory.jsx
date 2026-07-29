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

import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const [dropdowns, setDropdowns] = useState({ lines: [], refractoryTypes: [] });
  const [stocks, setStocks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("All");
  const [selectedLineFilter, setSelectedLineFilter] = useState("All");

  // Form Modal States
  const [openAddForm, setOpenAddForm] = useState(false);
  
  // Use Stock Modal States
  const [openUseForm, setOpenUseForm] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [useQuantity, setUseQuantity] = useState(1);
  const [useRemarks, setUseRemarks] = useState("");
  const [submittingUse, setSubmittingUse] = useState(false);

  const canAdd = userRole === 'Admin' || userRole === 'Editor';

  // 1. Fetch settings/dropdowns in real-time
  useEffect(() => {
    const docRef = doc(db, 'settings', 'dropdowns');
    const unsubscribeDropdowns = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDropdowns({
          lines: data.lines || ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2'],
          refractoryTypes: data.refractoryTypes || ['Lip block', 'Moving block', 'Overflow block', 'Flat arc']
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

  // 3.5 Sort lines naturally (e.g. SG#1, SG#2, SG#3.1, SG#3.2)
  const sortedLines = useMemo(() => {
    return [...dropdowns.lines].sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [dropdowns.lines]);

  // 4. Calculate Line-wise & Type-wise Summary Stock Matrix
  const lineWiseSummary = useMemo(() => {
    const lines = dropdowns.lines;
    const types = dropdowns.refractoryTypes;
    const summary = {};

    lines.forEach(line => {
      summary[line] = {};
      types.forEach(type => {
        summary[line][type] = 0;
      });
    });

    stocks.forEach(stock => {
      if (stock.units > 0 && summary[stock.line] && summary[stock.line][stock.type] !== undefined) {
        summary[stock.line][stock.type] += Number(stock.units);
      }
    });

    return summary;
  }, [stocks, dropdowns]);

  // 5. Filter Active Stock List
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const matchesSearch =
        stock.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.line.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedTypeFilter === "All" || stock.type === selectedTypeFilter;
      const matchesLine = selectedLineFilter === "All" || stock.line === selectedLineFilter;

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

      {/* Section 1: Modern Line-wise Summary (Replacement for standard tables) */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <FactoryIcon color="primary" /> Line-Wise Stock Status
      </Typography>

      {loading ? (
        <Box
          display="flex"
          flexDirection={{ xs: 'column', sm: 'row' }}
          flexWrap="wrap"
          gap={3}
          mb={5}
          width="100%"
        >
          {[1, 2, 3, 4].map(idx => (
            <Skeleton
              key={idx}
              animation="wave"
              variant="rounded"
              height={160}
              sx={{
                borderRadius: 3,
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }
              }}
            />
          ))}
        </Box>
      ) : (
        <Box
          display="flex"
          flexDirection={{ xs: 'column', sm: 'row' }}
          flexWrap="wrap"
          gap={3}
          mb={5}
          width="100%"
        >
          {sortedLines.map(line => {
            const lineSummary = lineWiseSummary[line] || {};
            const totalLineUnits = Object.values(lineSummary).reduce((a, b) => a + b, 0);

            return (
              <Card
                key={line}
                elevation={3}
                sx={{
                  flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%)',
                  border: '1px solid #e3edf7',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 12px 20px rgba(0,0,0,0.08)'
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  {/* Header */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight="bold" color="text.primary">
                      {line}
                    </Typography>
                    <Chip
                      label={`${totalLineUnits} Total`}
                      color={totalLineUnits === 0 ? "default" : totalLineUnits < 15 ? "warning" : "primary"}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  {/* Stock Details */}
                  <Stack spacing={1.5}>
                    {dropdowns.refractoryTypes.map(type => {
                      const count = lineSummary[type] || 0;
                      const status = getStockStatus(count);
                      return (
                        <Box key={type} display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, pr: 1, lineHeight: 1.2 }}>
                            {type}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 'fit-content' }}>
                            <Typography variant="body2" fontWeight="bold" color={status.color === 'error' ? 'error.main' : 'text.primary'}>
                              {count} {count === 1 ? 'unit' : 'units'}
                            </Typography>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: `${status.color}.main`
                              }}
                            />
                          </Box>
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

          <Grid item xs={12} sm={8} md={5}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ minWidth: 'fit-content' }}>
                Line:
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
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    textTransform: 'none',
                    fontWeight: 'bold',
                    border: '1px solid #e0e0e0',
                    py: 0.75,
                    px: 1.5,
                    color: 'text.secondary',
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
                <ToggleButton value="All" sx={{ borderTopLeftRadius: '8px !important', borderBottomLeftRadius: '8px !important' }}> All </ToggleButton>
                {sortedLines.map((l, index) => {
                  const isLast = index === sortedLines.length - 1;
                  return (
                    <ToggleButton
                      key={l}
                      value={l}
                      sx={{
                        borderTopRightRadius: isLast ? '8px !important' : '0',
                        borderBottomRightRadius: isLast ? '8px !important' : '0'
                      }}
                    >
                      {l}
                    </ToggleButton>
                  );
                })}
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
                    {/* Column 1: Type & Supplier */}
                    <Box sx={{ width: { xs: '100%', md: '25%' } }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">
                        {stock.type}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Supplier: <strong>{stock.supplierName}</strong>
                      </Typography>
                    </Box>

                    {/* Column 2: Line Chip */}
                    <Box sx={{ width: { xs: 'auto', md: '15%' } }}>
                      <Chip
                        icon={<FactoryIcon />}
                        label={stock.line}
                        variant="outlined"
                        size="small"
                        sx={{ borderRadius: 1.5 }}
                      />
                    </Box>

                    {/* Column 3: Units / Progress */}
                    <Box sx={{ width: { xs: '100%', md: '25%' } }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {stock.units} / {stock.initialUnits} Units
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

                    {/* Column 5: Use Button */}
                    <Box sx={{ width: { xs: '100%', md: '15%' }, display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                      {canAdd && (
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
                    <TableCell><strong>Refractory Type</strong></TableCell>
                    <TableCell><strong>Line</strong></TableCell>
                    <TableCell align="right"><strong>Qty Added</strong></TableCell>
                    <TableCell align="right"><strong>Remaining</strong></TableCell>
                    <TableCell><strong>Supplier</strong></TableCell>
                    <TableCell><strong>Added By</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
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
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {stock.type}
                      </TableCell>
                      <TableCell>
                        <Chip label={stock.line} size="small" sx={{ borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        +{stock.initialUnits}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {stock.units}
                      </TableCell>
                      <TableCell>{stock.supplierName}</TableCell>
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
                      <TableCell italic="true" color="text.secondary">
                        {log.remarks || '-'}
                      </TableCell>
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

      {/* Floating Action Button to Add New Refractory */}
      {canAdd && (
        <Fab
          color="primary"
          aria-label="add stock"
          sx={{ position: 'fixed', bottom: 32, right: 32, boxShadow: 4 }}
          onClick={() => setOpenAddForm(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Dialog Form for Adding New Stock */}
      <RefractoryForm
        open={openAddForm}
        onClose={() => setOpenAddForm(false)}
        dropdowns={dropdowns}
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
    </Container>
  );
}