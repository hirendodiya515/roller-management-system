import React, { useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  MenuItem, 
  Grid, 
  Box,
  InputAdornment,
  IconButton,
  Typography,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useSnackbar } from 'notistack';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import TimelineIcon from '@mui/icons-material/Timeline';
import StraightenIcon from '@mui/icons-material/Straighten';
import FactoryIcon from '@mui/icons-material/Factory';
import GradientIcon from '@mui/icons-material/Gradient';
import CommentIcon from '@mui/icons-material/Comment';

// --- Validation Schema ---
const schema = yup.object().shape({
  rollerDiameter: yup.number().typeError('Must be a number').positive("Must be > 0").required("Required"),
  runningLine: yup.string().required("Required"),
  activity: yup.string().required("Required"),
  date: yup.date().required("Required"),
  rollerRa: yup.number().typeError('Num').required("Req"),
  rollerRz: yup.number().typeError('Num').required("Req"),
  glassRa: yup.number().typeError('Num').required("Req"),
  glassRz: yup.number().typeError('Num').required("Req"),
  remarks: yup.string(),
});

// --- Constants ---
const ACTIVITY_OPTIONS = ['Production Start', 'Production End', 'Roller Sent', 'Roller Received'];
const LINE_OPTIONS = ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2']; // Updated Options

export default function RecordForm({ open, onClose, initialData, rollerId }) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      date: new Date(), activity: '', rollerDiameter: '', runningLine: '', 
      rollerRa: '', rollerRz: '', glassRa: '', glassRz: '', remarks: ''
    }
  });
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (initialData) {
        reset({ 
            ...initialData, 
            date: initialData.date ? new Date(initialData.date.seconds * 1000) : new Date() 
        });
    } else {
        reset({ 
            date: new Date(), activity: '', rollerDiameter: '', runningLine: '', 
            rollerRa: '', rollerRz: '', glassRa: '', glassRz: '', remarks: ''
        });
    }
  }, [initialData, open, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, createdBy: auth.currentUser.uid };
      if (!initialData) {
          payload.status = 'Pending';
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, `rollers/${rollerId}/records`), payload);
      } else {
          await updateDoc(doc(db, `rollers/${rollerId}/records`, initialData.id), payload);
      }
      enqueueSnackbar('Record saved successfully', { variant: 'success' });
      onClose();
    } catch (err) {
      enqueueSnackbar('Error: ' + err.message, { variant: 'error' });
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md" 
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'primary.main', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {initialData ? 'Edit History Record' : 'Add Service Record'}
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ mt: 1 }}>
            
            {/* Row 1: Date & Activity (Now shared 50/50 space) */}
            <Grid container spacing={3}>
              
              <Grid item xs={12} sm={6}>
                <Controller 
                  name="date" 
                  control={control} 
                  render={({ field }) => (
                    <DatePicker 
                      {...field} 
                      label="Date of Activity" 
                      slotProps={{ 
                        textField: { 
                          fullWidth: true, 
                          error: !!errors.date,
                          helperText: errors.date?.message
                        } 
                      }} 
                    />
                  )} 
                />
              </Grid>
              
              {/* WIDENED ACTIVITY BOX (sm={6} same as date) */}
              <Grid item xs={12} sm={6}>
                <Controller 
                  name="activity" 
                  control={control} 
                  render={({ field }) => (
                    <TextField 
                      select 
                      fullWidth 
                      label="Activity Type" 
                      {...field} 
                      error={!!errors.activity}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <TimelineIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    >
                      {ACTIVITY_OPTIONS.map(o=><MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  )} 
                />
              </Grid>

              {/* Row 2: Line (Dropdown) & Diameter */}
              
              {/* NEW: Running Line as DROPDOWN */}
              <Grid item xs={12} sm={6}>
                <Controller 
                  name="runningLine" 
                  control={control} 
                  render={({ field }) => (
                    <TextField 
                      select  // Changed to select
                      fullWidth 
                      label="Current Running Line" 
                      {...field} 
                      error={!!errors.runningLine}
                      helperText={errors.runningLine?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <FactoryIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    >
                      {/* Use constants defined above */}
                      {LINE_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </TextField>
                  )} 
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller 
                  name="rollerDiameter" 
                  control={control} 
                  render={({ field }) => (
                    <TextField 
                      fullWidth 
                      label="Roller Diameter (mm)" 
                      type="number" 
                      {...field} 
                      error={!!errors.rollerDiameter}
                      helperText={errors.rollerDiameter?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <StraightenIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )} 
                />
              </Grid>
            </Grid>

            {/* Tech Section Header */}
            <Box sx={{ mt: 4, mb: 2 }}>
              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Technical Readings (Ra / Rz)
                </Typography>
              </Divider>
            </Box>

            {/* Tech Readings & Remarks */}
            <Grid container spacing={2}>
              
              {['rollerRa', 'rollerRz', 'glassRa', 'glassRz'].map((name) => (
                <Grid item xs={6} sm={3} key={name}>
                  <Controller 
                    name={name} 
                    control={control} 
                    render={({ field }) => (
                      <TextField 
                        fullWidth 
                        label={name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                        type="number" 
                        {...field} 
                        size="small" 
                        error={!!errors[name]}
                        helperText={errors[name]?.message}
                        InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <GradientIcon fontSize="small" color="primary" sx={{ opacity: 0.7 }} />
                              </InputAdornment>
                            ),
                          }}
                      />
                    )} 
                  />
                </Grid>
              ))}

              {/* UPDATED: Remarks Field - Full Width (xs=12) & Increased Height */}
              <Grid item xs={12}>
                <Controller 
                  name="remarks" 
                  control={control} 
                  render={({ field }) => (
                    <TextField 
                      fullWidth 
                      multiline 
                      rows={3} // Made it taller
                      label="Additional Remarks" 
                      {...field} 
                      placeholder="Any observations about scratches, wear, or logistics..."
                      sx={{ mt: 1 }} // Small spacing from top
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mt: '8px', alignSelf: 'flex-start' }}>
                            <CommentIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )} 
                />
              </Grid>
            </Grid>

          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: '#f9f9f9', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" size="large" sx={{ minWidth: 120, borderRadius: 2 }}>
            Save Record
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}