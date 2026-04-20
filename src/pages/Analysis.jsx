import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Grid,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Card,
    CardContent,
    CircularProgress
} from '@mui/material';
import {
    BarChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import Papa from 'papaparse';
import DownloadIcon from '@mui/icons-material/Download';
import { DatePicker } from '@mui/x-date-pickers';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { 
    addDays, 
    startOfWeek, 
    endOfWeek, 
    isBefore, 
    isAfter, 
    isWithinInterval, 
    format 
} from 'date-fns';
import { fetchAlertConfig } from '../services/alertService';

export default function Analysis() {
    const [loading, setLoading] = useState(true);
    const [rollers, setRollers] = useState([]);
    const [allRecords, setAllRecords] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [reasonData, setReasonData] = useState([]);
    const [turnaroundData, setTurnaroundData] = useState([]);
    const [expectedReceivingData, setExpectedReceivingData] = useState([]);
    const [vendorDistributionData, setVendorDistributionData] = useState([]);
    const [selectedLine, setSelectedLine] = useState('All');

    const lines = ['All', 'SG#1', 'SG#2', 'SG#3.1', 'SG#3.2'];

    const [users, setUsers] = useState({});

    // Date Filter State
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [appliedDateRange, setAppliedDateRange] = useState({ start: null, end: null });

    // Status Chart State
    const [statusData, setStatusData] = useState([]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    useEffect(() => {
        fetchData();
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const userMap = {};
            usersSnapshot.docs.forEach(doc => {
                const data = doc.data();
                userMap[doc.id] = data.email || data.name || 'Unknown User';
            });
            setUsers(userMap);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchData = async () => {
        try {
            const rollersSnapshot = await getDocs(collection(db, 'rollers'));
            const rollersData = rollersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRollers(rollersData);

            const recordsPromises = rollersData.map(async (roller) => {
                const recordsQuery = query(
                    collection(db, `rollers/${roller.id}/records`),
                    orderBy('date', 'desc')
                );
                const recordsSnapshot = await getDocs(recordsQuery);
                return recordsSnapshot.docs.map(doc => ({
                    ...doc.data(),
                    rollerId: roller.id,
                    rollerNumber: roller.rollerNumber,
                    line: roller.line,
                    position: roller.position,
                    make: roller.make
                }));
            });

            const allRecordsArrays = await Promise.all(recordsPromises);
            const flatRecords = allRecordsArrays.flat();
            setAllRecords(flatRecords);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (allRecords.length > 0 && rollers.length > 0) {
            processChartData();
        }
    }, [allRecords, rollers, appliedDateRange]);

    const handleApplyFilter = () => {
        setAppliedDateRange({ start: startDate, end: endDate });
    };

    const handleClearFilter = () => {
        setStartDate(null);
        setEndDate(null);
        setAppliedDateRange({ start: null, end: null });
    };

    const processChartData = () => {
        // Filter records based on date range
        let filteredRecords = allRecords;
        if (appliedDateRange.start && appliedDateRange.end) {
            const start = new Date(appliedDateRange.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(appliedDateRange.end);
            end.setHours(23, 59, 59, 999);

            filteredRecords = allRecords.filter(r => {
                if (!r.date) return false;
                const rDate = r.date.toDate ? r.date.toDate() : new Date(r.date);
                return rDate >= start && rDate <= end;
            });
        }

        // 1. Monthly Rollers Sent (Filtered)
        const rollerSentRecords = filteredRecords.filter(r =>
            r.activity === 'Roller sent' && r.status === 'Approved'
        );

        const monthlyMap = {};
        rollerSentRecords.forEach(record => {
            if (record.date) {
                const date = record.date.toDate ? record.date.toDate() : new Date(record.date);
                const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + 1;
            }
        });

        const monthlyArray = Object.entries(monthlyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12)
            .map(([month, count]) => ({
                month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                count
            }));
        setMonthlyData(monthlyArray);

        // 2. Reason-wise Pareto (Filtered)
        const reasonMap = {};
        rollerSentRecords.forEach(record => {
            // Find the specific "Reason_for_sending_roller" field
            const allKeys = Object.keys(record);

            // Try multiple patterns to find the reason field
            const reasonKey = allKeys.find(key =>
                key.includes('Reason_for_sending_roller') ||
                key.includes('reason_for_sending') ||
                key === 'reasonForSending' ||
                (key.toLowerCase().includes('reason') && key.toLowerCase().includes('sending'))
            );

            const reason = reasonKey && record[reasonKey] && String(record[reasonKey]).trim()
                ? String(record[reasonKey]).trim()
                : 'Not Specified';

            reasonMap[reason] = (reasonMap[reason] || 0) + 1;
        });

        const reasonArray = Object.entries(reasonMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        let cumulative = 0;
        const total = reasonArray.reduce((sum, [, count]) => sum + count, 0);
        const paretoData = reasonArray.map(([reason, count]) => {
            cumulative += count;
            return {
                reason: reason, // Keep full reason for tooltip
                count,
                cumulative: Math.round((cumulative / total) * 100)
            };
        });
        setReasonData(paretoData);


        // 3. Average Turnaround Time (Filtered)
        const turnaroundMap = {};
        rollers.forEach(roller => {
            // Use filtered records for turnaround calculation? 
            // Turnaround spans across time, so strict filtering might break pairs.
            // Strategy: Use ALL records for finding pairs, but only count if the 'Received' date is in range.

            const rollerRecords = allRecords // Use ALL records to find pairs
                .filter(r => r.rollerId === roller.id && r.status === 'Approved')
                .sort((a, b) => {
                    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                    return dateA - dateB;
                });

            for (let i = 0; i < rollerRecords.length - 1; i++) {
                if (rollerRecords[i].activity === 'Roller sent' &&
                    rollerRecords[i + 1].activity === 'Roller Received') {

                    const sentDate = rollerRecords[i].date?.toDate ? rollerRecords[i].date.toDate() : new Date(rollerRecords[i].date);
                    const receivedDate = rollerRecords[i + 1].date?.toDate ? rollerRecords[i + 1].date.toDate() : new Date(rollerRecords[i + 1].date);

                    // Check if this turnaround event falls within the selected range (based on Received Date)
                    let inRange = true;
                    if (appliedDateRange.start && appliedDateRange.end) {
                        const start = new Date(appliedDateRange.start);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(appliedDateRange.end);
                        end.setHours(23, 59, 59, 999);
                        inRange = receivedDate >= start && receivedDate <= end;
                    }

                    if (inRange) {
                        const days = Math.round((receivedDate - sentDate) / (1000 * 60 * 60 * 24));
                        if (days >= 0 && days < 365) {
                            const line = roller.line;
                            if (!turnaroundMap[line]) {
                                turnaroundMap[line] = [];
                            }
                            turnaroundMap[line].push(days);
                        }
                    }
                }
            }
        });

        const turnaroundArray = Object.entries(turnaroundMap).map(([line, days]) => ({
            line,
            avgDays: Math.round(days.reduce((sum, d) => sum + d, 0) / days.length)
        }));
        setTurnaroundData(turnaroundArray);

        // 4. Status Distribution (Snapshot - Not filtered by date usually, but let's keep it as current snapshot)
        // If user wants status distribution "at that time", it's complex. 
        // We will show CURRENT status distribution regardless of date filter, 
        // OR we can filter rollers created/updated in that range? 
        // Standard behavior for "Status Distribution" is usually "Current State". 
        // Let's stick to Current State for now as it's most useful.

        const statusMap = {};
        rollers.forEach(roller => {
            const status = roller.currentStatus || 'Unknown';
            statusMap[status] = (statusMap[status] || 0) + 1;
        });

        const statusChartData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
        setStatusData(statusChartData);

        // 5. Expected Roller Receiving (Week-wise)
        processExpectedReceiving(filteredRecords);

        // 6. Vendor-wise Distribution (Latest status)
        processVendorDistribution();
    };

    const processVendorDistribution = () => {
        const vendorMap = {};

        rollers.forEach(roller => {
            // Find the latest approved record for this roller
            // allRecords is grouped by roller from fetchData, so we can find the first one
            const latestRecord = allRecords.find(r => r.rollerId === roller.id && r.status === 'Approved');

            if (latestRecord && latestRecord.activity === 'Roller sent') {
                const allKeys = Object.keys(latestRecord);
                const vendorKey = allKeys.find(key => 
                    key.toLowerCase().includes('vendor') || 
                    key.toLowerCase().includes('supplier') ||
                    key.toLowerCase().includes('party')
                );

                const vendor = vendorKey && latestRecord[vendorKey] 
                    ? String(latestRecord[vendorKey]).trim() 
                    : 'Unknown Vendor';

                if (vendor) {
                    vendorMap[vendor] = (vendorMap[vendor] || 0) + 1;
                }
            }
        });

        const vendorArray = Object.entries(vendorMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        setVendorDistributionData(vendorArray);
    };

    const processExpectedReceiving = async (filteredRecords) => {
        try {
            const alertConfig = await fetchAlertConfig();
            const returnDays = alertConfig?.rollerSentDelay?.days || 5;

            const now = new Date();
            const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
            const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

            const nextWeekStart = addDays(currentWeekStart, 7);
            const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

            const week2Start = addDays(nextWeekStart, 7);
            const week2End = endOfWeek(week2Start, { weekStartsOn: 1 });

            const week3Start = addDays(week2Start, 7);
            const week3End = endOfWeek(week3Start, { weekStartsOn: 1 });

            const categories = {
                'Previous Week(s)': 0,
                'Current Week': 0,
                'Next Week': 0,
                'After 2 Weeks': 0,
                'After 3 Weeks': 0,
                'Later': 0
            };

            // Iterate over ALL rollers to find their current status
            // This ensures we don't count the same roller multiple times if it has multiple history records
            // and ensures consistency with Dashboard logic
            rollers.forEach(roller => {
                // Find latest approved record for this roller from allRecords
                const rollerRecords = allRecords.filter(r => r.rollerId === roller.id && r.status === 'Approved' && r.activity !== 'Roller PDI');
                
                if (rollerRecords.length > 0) {
                    // Sort to get latest
                    rollerRecords.sort((a, b) => {
                        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                        return dateB - dateA;
                    });

                    const latestRecord = rollerRecords[0];
                    const activityType = latestRecord.activity;
                    let currentStatus = 'No Activity';

                    // Replicating Dashboard Logic for Status
                    if (activityType === 'Roller Received') {
                        const allKeys = Object.keys(latestRecord);
                        const readyToUseKey = allKeys.find(key => key.toLowerCase().startsWith('ready_to_use'));
                        const readyValue = readyToUseKey ? latestRecord[readyToUseKey] : undefined;

                        currentStatus = readyValue === 'Yes' ? 'Ready to Use' : 'To be sent';
                    } else if (activityType === 'Production Start') {
                        currentStatus = 'Running';
                    } else if (activityType === 'Production End') {
                        currentStatus = 'To be sent';
                    } else if (activityType === 'Roller sent') {
                        currentStatus = 'Sent to Vendor';
                    } else if (activityType === 'Scrap') {
                        currentStatus = 'Scrap';
                    }

                    // Only count if currently Sent to Vendor
                    if (currentStatus === 'Sent to Vendor') {
                        const sentDate = latestRecord.date?.toDate ? latestRecord.date.toDate() : new Date(latestRecord.date);
                        const expectedDate = addDays(sentDate, returnDays);

                        if (isBefore(expectedDate, currentWeekStart)) {
                            categories['Previous Week(s)']++;
                        } else if (isWithinInterval(expectedDate, { start: currentWeekStart, end: currentWeekEnd })) {
                            categories['Current Week']++;
                        } else if (isWithinInterval(expectedDate, { start: nextWeekStart, end: nextWeekEnd })) {
                            categories['Next Week']++;
                        } else if (isWithinInterval(expectedDate, { start: week2Start, end: week2End })) {
                            categories['After 2 Weeks']++;
                        } else if (isWithinInterval(expectedDate, { start: week3Start, end: week3End })) {
                            categories['After 3 Weeks']++;
                        } else {
                            categories['Later']++;
                        }
                    }
                }
            });

            const expectedDataArray = Object.entries(categories).map(([name, count]) => ({
                name,
                count
            }));

            setExpectedReceivingData(expectedDataArray);
        } catch (error) {
            console.error("Error processing expected receiving data:", error);
        }
    };

    const exportLineWiseRollers = () => {
        const filteredRollers = selectedLine === 'All'
            ? rollers
            : rollers.filter(r => r.line === selectedLine);

        const csvData = filteredRollers.map(roller => ({
            'Roller Number': roller.rollerNumber,
            'Line': roller.line,
            'Position': roller.position,
            'Make': roller.make,
            'Status': roller.status,
            'Created At': roller.createdAt?.toDate ? roller.createdAt.toDate().toLocaleDateString() : 'N/A'
        }));

        const csv = Papa.unparse(csvData);
        downloadCSV(csv, `rollers_${selectedLine}_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const exportCompleteHistory = async () => {
        const historyData = [];

        for (const roller of rollers) {
            let rollerRecords = allRecords.filter(r => r.rollerId === roller.id);

            // Apply Date Filter
            if (appliedDateRange.start && appliedDateRange.end) {
                const start = new Date(appliedDateRange.start);
                start.setHours(0, 0, 0, 0);
                const end = new Date(appliedDateRange.end);
                end.setHours(23, 59, 59, 999);

                rollerRecords = rollerRecords.filter(r => {
                    if (!r.date) return false;
                    const rDate = r.date.toDate ? r.date.toDate() : new Date(r.date);
                    return rDate >= start && rDate <= end;
                });
            }

            rollerRecords.forEach(record => {
                // Base fields
                const row = {
                    'Roller Number': roller.rollerNumber,
                    'Line': roller.line,
                    'Position': roller.position,
                    'Make': roller.make,
                    'Activity': record.activity,
                    'Date': record.date?.toDate ? record.date.toDate().toLocaleDateString() : 'N/A',
                    'Status': record.status,
                    'Created By': users[record.createdBy] || record.createdBy || 'N/A',
                    'Approved By': users[record.approvedBy] || record.approvedBy || 'N/A',
                    'Remarks': record.remarks || ''
                };

                // Add all other dynamic fields from the record
                // Exclude fields we've already handled or internal fields
                const excludedFields = [
                    'activity', 'date', 'status', 'createdBy', 'approvedBy', 'remarks',
                    'rollerId', 'rollerNumber', 'line', 'position', 'make', 'id',
                    'createdAt', 'approvedAt', 'approvalInfo'
                ];

                Object.keys(record).forEach(key => {
                    if (!excludedFields.includes(key)) {
                        // Format key for header (camelCase to Title Case)
                        const header = key
                            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
                            .replace(/^./, str => str.toUpperCase()); // Capitalize first letter

                        row[header] = record[key];
                    }
                });

                historyData.push(row);
            });
        }

        const csv = Papa.unparse(historyData);
        downloadCSV(csv, `complete_history_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const downloadCSV = (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                    <CircularProgress size={60} />
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
            {/* Header & Filter */}
            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={4} gap={2}>
                <Box display="flex" alignItems="center">
                    <AssessmentIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                    <Typography variant="h4" fontWeight="bold" color="primary">
                        Analysis & Reports
                    </Typography>
                </Box>

                <Paper elevation={1} sx={{ p: 1, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={(newValue) => setStartDate(newValue)}
                        slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                    />
                    <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={(newValue) => setEndDate(newValue)}
                        slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleApplyFilter}
                        startIcon={<FilterListIcon />}
                        size="small"
                    >
                        Apply
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleClearFilter}
                        startIcon={<ClearIcon />}
                        size="small"
                        color="inherit"
                    >
                        Clear
                    </Button>
                </Paper>
            </Box>

            {/* Charts Section */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Status Distribution (New) */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Current Status Distribution
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Snapshot of all rollers
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>
                {/* Month-wise Rollers Sent */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Monthly Rollers Sent
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Last 12 months trend
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#42A5F5" name="Rollers Sent" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Reason-wise Pareto */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Reasons for Roller Sent (Pareto)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Top reasons and cumulative %
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <ComposedChart data={reasonData} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="reason"
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        interval={0}
                                        tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                                    />
                                    <YAxis yAxisId="left" />
                                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                                    <Tooltip />
                                    <Bar yAxisId="left" dataKey="count" fill="#FDD835" name="Count" />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="cumulative"
                                        stroke="#FF9800"
                                        strokeWidth={2}
                                        name="Cumulative %"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Average Turnaround Time */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Average Turnaround Time (Sent to Received)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Average days by line
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={turnaroundData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="line" />
                                    <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="avgDays" fill="#66BB6A" name="Avg Days" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Expected Roller Receiving */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Expected Roller Receiving (Week-wise)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Based on Sent Date + Vendor Return Days from Alert Config
                            </Typography>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={expectedReceivingData} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#8884d8" name="Expected Rollers">
                                        {expectedReceivingData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.name === 'Previous Week(s)' ? '#EF5350' : '#42A5F5'} 
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Vendor Distribution */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Rollers with Vendors
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Distribution of rollers currently sent to vendors
                            </Typography>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={vendorDistributionData} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="name" 
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        interval={0}
                                    />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#FFA726" name="Rollers Count" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Export Section */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
                <Box display="flex" alignItems="center" mb={3}>
                    <DownloadIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                        Export Data
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {/* Line-wise Export */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card elevation={0} sx={{ bgcolor: 'rgba(66, 165, 245, 0.1)', p: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Line-wise Roller List
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Export roller inventory by production line
                            </Typography>
                            <Box display="flex" gap={2} alignItems="center">
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Line</InputLabel>
                                    <Select
                                        value={selectedLine}
                                        label="Line"
                                        onChange={(e) => setSelectedLine(e.target.value)}
                                    >
                                        {lines.map(line => (
                                            <MenuItem key={line} value={line}>{line}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadIcon />}
                                    onClick={exportLineWiseRollers}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Export CSV
                                </Button>
                            </Box>
                        </Card>
                    </Grid>

                    {/* Complete History Export */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card elevation={0} sx={{ bgcolor: 'rgba(102, 187, 106, 0.1)', p: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Complete History
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                Export all records with creator and approver info
                            </Typography>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<DownloadIcon />}
                                onClick={exportCompleteHistory}
                                sx={{ textTransform: 'none' }}
                            >
                                Export Full History
                            </Button>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}
