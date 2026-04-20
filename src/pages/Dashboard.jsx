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
  Skeleton,
  Divider
} from '@mui/material';
import { collection, onSnapshot, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Icons
import AnalyticsIcon from '@mui/icons-material/Analytics';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import ProductionQuantityLimitsIcon from '@mui/icons-material/ProductionQuantityLimits';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { FormControl, InputLabel, Select, MenuItem, Avatar } from '@mui/material';

const LINES = ['SG#1', 'SG#2', 'SG#3']; // For Top/Bottom summary
const PRODUCTION_LINES = ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2']; // For Production End cards
const TOTAL_CAPACITY = 136;

// Status colors matching RollerDetails
const STATUS_COLORS = {
  'Running': '#42A5F5',           // Light Blue
  'Sent to Vendor': '#FDD835', // Yellow
  'To be sent': '#FF9800',        // Orange
  'Ready to Use': '#66BB6A',      // Green
  'Scrap': '#EF5350',             // Red
  'No Activity': '#9E9E9E'        // Grey
};

export default function Dashboard() {
  const [rollers, setRollers] = useState([]);
  const [records, setRecords] = useState({}); // Stores { status, record }
  const [loading, setLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState('');
  const [availableDesigns, setAvailableDesigns] = useState([]);
  const navigate = useNavigate();

  // Fetch all rollers and their latest approved records
  useEffect(() => {
    const unsubscribeRollers = onSnapshot(collection(db, 'rollers'), async (snapshot) => {
      const rollerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRollers(rollerData);

      // Fetch latest approved record for each roller to get current status in PARALLEL
      const recordPromises = rollerData.map(async (roller) => {
        try {
          const recordsQuery = query(
            collection(db, `rollers/${roller.id}/records`),
            orderBy('date', 'desc')
          );
          const recordsSnapshot = await getDocs(recordsQuery);
          const approvedRecords = recordsSnapshot.docs
            .map(doc => doc.data())
            .filter(r => r.status === 'Approved' && r.activity !== 'Roller PDI');

          if (approvedRecords.length > 0) {
            const latestRecord = approvedRecords[0];
            const activityType = latestRecord.activity;

            let currentStatus = 'No Activity';
            
            // Find latest Production End record for date display
            const prodEndRecord = approvedRecords.find(r => r.activity === 'Production End');
            const productionEndDate = prodEndRecord ? prodEndRecord.date : null;

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

            return { id: roller.id, status: currentStatus, record: latestRecord, productionEndDate };
          } else {
            return { id: roller.id, status: 'No Activity', record: null };
          }
        } catch (error) {
          console.error(`Error fetching records for roller ${roller.id}:`, error);
          return { id: roller.id, status: 'No Activity', record: null };
        }
      });

      const results = await Promise.all(recordPromises);
      const recordsData = {};
      results.forEach(r => {
        recordsData[r.id] = { 
            status: r.status, 
            record: r.record,
            productionEndDate: r.productionEndDate 
        };
      });

      setRecords(recordsData);

      // Extract available designs
      const designs = new Set();
      Object.values(recordsData).forEach(item => {
         const record = item.record;
         if (record) {
             const key = Object.keys(record).find(k => k.toLowerCase().includes('design'));
             if (key && record[key]) {
                 designs.add(record[key]);
             }
         }
      });
      setAvailableDesigns(Array.from(designs).sort());

      setLoading(false);
    });

    return () => unsubscribeRollers();
  }, []);

  const handleStatusClick = (line, position, status) => {
    navigate(`/rollers?line=${encodeURIComponent(line)}&position=${encodeURIComponent(position)}&status=${encodeURIComponent(status)}`);
  };

  const getDesignFromRecord = (record) => {
    if (!record) return '-';
    // Look for a key that contains "design" (case insensitive)
    const key = Object.keys(record).find(k => k.toLowerCase().includes('design'));
    return key ? record[key] : '-';
  };

  const renderLineCard = (line, position) => {
    let lineRollers;
    if (line === 'SG#3') {
      lineRollers = rollers.filter(r =>
        (r.line === 'SG#3.1' || r.line === 'SG#3.2') && r.position === position
      );
    } else {
      lineRollers = rollers.filter(r => r.line === line && r.position === position);
    }

    const totalRollers = lineRollers.length;

    const statusCounts = {
      'Running': 0,
      'Sent to Vendor': 0,
      'To be sent': 0,
      'Ready to Use': 0,
      'Scrap': 0
    };

    lineRollers.forEach(roller => {
      const status = records[roller.id]?.status || 'No Activity';
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
                    minHeight: '48px',
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
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      lineHeight: 1.2,
                      textAlign: 'left',
                      mr: 1,
                      flex: 1
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

  const renderRunningRollerCard = (line) => {
    // Filter rollers for this line that are in "Running" status
    const runningRollers = rollers.filter(r => {
      const isLineMatch = r.line === line;
      const status = records[r.id]?.status;
      return isLineMatch && status === 'Running';
    });

    return (
      <Grid item xs={12} sm={6} md={true} sx={{ flexGrow: 1, flexBasis: 0 }} key={`running-${line}`}>
        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            height: '100%',
            border: '1px solid #2196F3', // Blue border for Running
            bgcolor: '#E3F2FD' // Light Blue background
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold" color="#1565C0">
                {line}
              </Typography>
              <Chip
                label="Running"
                size="small"
                sx={{ bgcolor: '#2196F3', color: 'white', fontWeight: 'bold' }}
              />
            </Box>

            <Divider sx={{ mb: 2, borderColor: '#90CAF9' }} />

            {runningRollers.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">
                No rollers Running
              </Typography>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {runningRollers.map(roller => {
                  const record = records[roller.id]?.record;
                  const date = record?.date?.seconds ? format(new Date(record.date.seconds * 1000), 'dd/MM/yyyy') : '-';
                  const design = getDesignFromRecord(record);

                  return (
                    <Paper
                      key={roller.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '1px solid #BBDEFB'
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                          #{roller.rollerNumber}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">
                          {roller.position}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        <strong>Date:</strong> {date}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        <strong>Design:</strong> {design}
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderProductionEndCard = (line) => {
    // 1. Filter rollers for this line that are in "To be sent" OR "Sent to Vendor"
    const candidates = rollers.filter(r => {
      const isLineMatch = r.line === line;
      const status = records[r.id]?.status;
      return isLineMatch && (status === 'To be sent' || status === 'Sent to Vendor');
    });

    // 2. Group by position and find the latest one for each position
    const latestByPosition = {};

    candidates.forEach(roller => {
      const position = roller.position;
      const record = records[roller.id]?.record;
      const recordDate = record?.date?.seconds || 0;

      if (!latestByPosition[position]) {
        latestByPosition[position] = { roller, date: recordDate };
      } else {
        // If this one is newer, replace the existing one
        if (recordDate > latestByPosition[position].date) {
          latestByPosition[position] = { roller, date: recordDate };
        }
      }
    });

    // 3. Convert back to array
    const productionEndRollers = Object.values(latestByPosition).map(item => item.roller);

    return (
      <Grid item xs={12} sm={6} md={true} sx={{ flexGrow: 1, flexBasis: 0 }} key={`prod-end-${line}`}>
        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            height: '100%',
            border: '1px solid #FF9800', // Orange border for Production End
            bgcolor: '#FFF3E0' // Light Orange background
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold" color="#E65100">
                {line}
              </Typography>
              <Chip
                label="Production End"
                size="small"
                sx={{ bgcolor: '#FF9800', color: 'white', fontWeight: 'bold' }}
              />
            </Box>

            <Divider sx={{ mb: 2, borderColor: '#FFB74D' }} />

            {productionEndRollers.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">
                No rollers in Production End
              </Typography>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {productionEndRollers.map(roller => {
                  const record = records[roller.id]?.record;
                  // Use specific Production End date if available, else fallback to record date
                  const prodEndDate = records[roller.id]?.productionEndDate;
                  const displayDateRaw = prodEndDate || record?.date;
                  
                  const date = displayDateRaw?.seconds ? format(new Date(displayDateRaw.seconds * 1000), 'dd/MM/yyyy') : '-';
                  const design = getDesignFromRecord(record);
                  const status = records[roller.id]?.status;

                  return (
                    <Paper
                      key={roller.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '1px solid #FFE0B2'
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                          #{roller.rollerNumber}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">
                          {roller.position}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        <strong>Date:</strong> {date}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        <strong>Design:</strong> {design}
                      </Typography>
                      {status === 'Sent to Vendor' && (
                         <Chip label="Sent" size="small" color="warning" variant="outlined" sx={{ mt: 1, height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Paper>
                  );
                })}
              </Box>
            )}
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center">
          <AnalyticsIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
          <Typography variant="h5" fontWeight="bold" color="primary">
            Roller Stock Overview
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="subtitle1" fontWeight="600" sx={{ color: 'text.secondary' }}>
            Total rollers in system <Box component="span" color="primary.main">{rollers.length}</Box>/{TOTAL_CAPACITY}
          </Typography>
          <Paper
            elevation={0}
            sx={{
              width: 50,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 2,
              fontWeight: 'bold',
              fontSize: '1.0rem',
              boxShadow: '0 4px 12px rgba(21, 101, 192, 0.2)'
            }}
          >
            {Math.round((rollers.length / TOTAL_CAPACITY) * 100)}%
          </Paper>
        </Box>
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

      {/* Running Roller Detail Section */}
      <Paper sx={{ p: 3, mt: 4, borderRadius: 4, bgcolor: '#E3F2FD', border: '1px solid #BBDEFB' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <ProductionQuantityLimitsIcon sx={{ color: '#1565C0', mr: 1, fontSize: 30 }} />
          <Typography variant="h5" fontWeight="bold" color="#1565C0">
            Running roller detail
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {loading ? (
            <>
              {renderSkeletonCard()}
              {renderSkeletonCard()}
              {renderSkeletonCard()}
              {renderSkeletonCard()}
            </>
          ) : (
            PRODUCTION_LINES.map(line => renderRunningRollerCard(line))
          )}
        </Grid>
      </Paper>

      {/* Production End Status Section */}
      <Paper sx={{ p: 3, mt: 4, borderRadius: 4, bgcolor: '#FFF8E1', border: '1px solid #FFE0B2' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <ProductionQuantityLimitsIcon sx={{ color: '#E65100', mr: 1, fontSize: 30 }} />
          <Typography variant="h5" fontWeight="bold" color="#E65100">
            Last run roller details
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {loading ? (
            <>
              {renderSkeletonCard()}
              {renderSkeletonCard()}
              {renderSkeletonCard()}
              {renderSkeletonCard()}
            </>
          ) : (
            PRODUCTION_LINES.map(line => renderProductionEndCard(line))
          )}
        </Grid>
      </Paper>

      {/* Design-wise Roller Count Section */}
      <Paper sx={{ p: 3, mt: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid #e0e0e0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
         <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
           <Box display="flex" alignItems="center">
             <AssignmentIcon color="primary" sx={{ mr: 1, fontSize: 30 }} />
             <Typography variant="h5" fontWeight="bold" color="primary">
               Design-wise Roller Count
             </Typography>
           </Box>
           <FormControl size="small" sx={{ minWidth: 200 }}>
             <InputLabel id="design-select-label">Select Design</InputLabel>
             <Select
               labelId="design-select-label"
               value={selectedDesign}
               label="Select Design"
               onChange={(e) => setSelectedDesign(e.target.value)}
               sx={{ borderRadius: 2 }}
             >
               <MenuItem value="">
                 <em>None</em>
               </MenuItem>
               {availableDesigns.map((design) => (
                 <MenuItem key={design} value={design}>
                   {design}
                 </MenuItem>
               ))}
             </Select>
           </FormControl>
         </Box>

         {selectedDesign ? (
           <Grid container spacing={3}>
             {LINES.map((line) => {
               // Calculate count for this line and selected design
               let lineRollers;
               if (line === 'SG#3') {
                 lineRollers = rollers.filter(r =>
                   (r.line === 'SG#3.1' || r.line === 'SG#3.2')
                 );
               } else {
                 lineRollers = rollers.filter(r => r.line === line);
               }

               const count = lineRollers.filter(r => {
                 const record = records[r.id]?.record;
                 const design = getDesignFromRecord(record);
                 return design === selectedDesign;
               }).length;

               return (
                 <Grid item xs={12} sm={6} md={4} key={line}>
                   <Card
                      elevation={0}
                      sx={{
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: count > 0 ? 'primary.light' : '#e0e0e0',
                        bgcolor: count > 0 ? '#F0F7FF' : '#fafafa',
                        cursor: count > 0 ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                           transform: count > 0 ? 'translateY(-2px)' : 'none',
                           boxShadow: count > 0 ? '0 12px 24px -10px rgba(0, 0, 0, 0.2)' : 'none',
                           borderColor: count > 0 ? 'primary.main' : '#e0e0e0'
                        }
                      }}
                       onClick={() => {
                         if (count > 0) {
                           navigate(`/rollers?line=${encodeURIComponent(line)}&design=${encodeURIComponent(selectedDesign)}`);
                         }
                       }}
                   >
                     <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                       <Typography variant="h6" fontWeight="bold" color={count > 0 ? 'primary.main' : 'text.disabled'}>
                         {line}
                       </Typography>
                       <Avatar 
                        sx={{ 
                          bgcolor: count > 0 ? 'primary.main' : '#bdbdbd', 
                          fontWeight: 'bold',
                          width: 36,
                          height: 36,
                          fontSize: '1rem'
                        }}
                       >
                         {count}
                       </Avatar>
                     </CardContent>
                   </Card>
                 </Grid>
               );
             })}
           </Grid>
         ) : (
           <Box textAlign="center" py={4} sx={{ bgcolor: '#fafafa', borderRadius: 3, border: '1px dashed #bdbdbd' }}>
             <Typography color="text.secondary">Please select a design to view line-wise counts</Typography>
           </Box>
         )}
      </Paper>

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