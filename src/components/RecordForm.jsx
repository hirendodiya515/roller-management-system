import React, { useEffect, useState, useMemo } from 'react';
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
  Divider,
  CircularProgress
} from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useSnackbar } from 'notistack';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import TimelineIcon from '@mui/icons-material/Timeline';
import StraightenIcon from '@mui/icons-material/Straighten';
import FactoryIcon from '@mui/icons-material/Factory';
import GradientIcon from '@mui/icons-material/Gradient';
import CommentIcon from '@mui/icons-material/Comment';
import EditIcon from '@mui/icons-material/Edit';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// Shared field styling
const fieldSx = {
  '& .MuiInputBase-root': { height: 54 },
  '& .MuiOutlinedInput-input': { padding: '14px 14px' },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', padding: '14px 14px', height: '54px' },
  '& .MuiInputAdornment-root': { height: 54, display: 'flex', alignItems: 'center' },
};

export default function RecordForm({ open, onClose, initialData, rollerId }) {
  const [dropdowns, setDropdowns] = useState({
    activityTypes: [],
    lines: []
  });
  const [fieldsConfig, setFieldsConfig] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // Fetch Dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const docRef = doc(db, 'settings', 'dropdowns');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDropdowns(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching dropdowns:", error);
      }
    };
    if (open) fetchDropdowns();
  }, [open]);

  // Dynamic Schema
  const schema = useMemo(() => {
    const shape = {
      date: yup.date().required("Required"),
      activity: yup.string().required("Required"),
    };

    fieldsConfig.forEach(field => {
      if (!field.visible) return;

      let validator;
      switch (field.type) {
        case 'number':
        case 'decimal':
          validator = yup.number().typeError('Must be a number');
          if (!field.required) validator = validator.nullable().transform((v) => (isNaN(v) ? null : v));
          break;
        case 'date':
        case 'time':
          validator = yup.date().nullable();
          break;
        default:
          validator = yup.string().nullable();
      }

      if (field.required) {
        validator = validator.required("Required");
      }

      shape[field.id] = validator;
    });

    return yup.object().shape(shape);
  }, [fieldsConfig]);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      date: new Date(),
      activity: '',
    }
  });

  const selectedActivity = watch('activity');

  // Fetch Config on Activity Change
  useEffect(() => {
    const fetchConfig = async () => {
      if (!selectedActivity) return;
      setLoadingConfig(true);
      try {
        const docRef = doc(db, 'formConfigs', selectedActivity);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().fields) {
          setFieldsConfig(docSnap.data().fields);
        } else {
          setFieldsConfig([
            { id: 'runningLine', label: 'Current Running Line', type: 'dropdown', required: true, visible: true, useGlobalOptions: 'lines' },
            { id: 'rollerDiameter', label: 'Roller Outer Dia.', type: 'number', required: true, visible: true },
            { id: 'designPattern', label: 'Design Pattern', type: 'dropdown', required: false, visible: true, useGlobalOptions: 'designPatterns' },
            { id: 'rollerRa', label: 'Roller Ra', type: 'number', required: true, visible: true },
            { id: 'rollerRz', label: 'Roller Rz', type: 'number', required: true, visible: true },
            { id: 'remarks', label: 'Remarks', type: 'long_text', required: false, visible: true },
          ]);
        }
      } catch (error) {
        console.error("Error fetching form config:", error);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [selectedActivity]);

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        date: initialData.date ? new Date(initialData.date.seconds * 1000) : new Date()
      });
      if (initialData.activity) {
        setValue('activity', initialData.activity);
      }
    } else {
      reset({ date: new Date(), activity: '' });
      setFieldsConfig([]);
    }
  }, [initialData, open, reset, setValue]);

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, createdBy: auth.currentUser.uid };

      if (!initialData) {
        payload.status = 'Pending';
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, `rollers/${rollerId}/records`), payload);

        // Update parent roller with latest status/activity
        // Note: This assumes the new record is the latest. 
        // Ideally we'd check dates, but for new records it's usually true.
        await updateDoc(doc(db, 'rollers', rollerId), {
          currentStatus: data.activity,
          lastUpdated: serverTimestamp()
        });

      } else {
        // If editing an existing record that was previously approved/rejected,
        // reset to Pending to require re-approval
        if (initialData.status === 'Approved' || initialData.status === 'Rejected') {
          payload.status = 'Pending';
          payload.approvedBy = null;
          payload.approvedAt = null;
          payload.approvalInfo = null;
        }

        await updateDoc(doc(db, `rollers/${rollerId}/records`, initialData.id), payload);

        // Also update parent if editing the latest record? 
        // For simplicity, let's update it to reflect the change.
        await updateDoc(doc(db, 'rollers', rollerId), {
          currentStatus: data.activity,
          lastUpdated: serverTimestamp()
        });
      }
      enqueueSnackbar('Record saved successfully', { variant: 'success' });
      onClose();
    } catch (err) {
      enqueueSnackbar('Error: ' + err.message, { variant: 'error' });
    }
  };

  const getIconForField = (field) => {
    if (field.id.includes('Diameter')) return <StraightenIcon color="action" />;
    if (field.id.includes('Line')) return <FactoryIcon color="action" />;
    if (field.id.includes('Ra') || field.id.includes('Rz')) return <GradientIcon fontSize="small" color="primary" sx={{ opacity: 0.7 }} />;
    if (field.type === 'date') return <CalendarTodayIcon color="action" />;
    if (field.type === 'time') return <AccessTimeIcon color="action" />;
    if (field.type === 'long_text') return <CommentIcon color="action" />;
    return <EditIcon color="action" />;
  };

  const renderDynamicField = (field) => {
    if (!field.visible) return null;

    const isLongText = field.type === 'long_text';
    const isNumber = field.type === 'number' || field.type === 'decimal';

    // Date
    if (field.type === 'date') {
      return (
        <Grid key={field.id} item xs={12} sx={{ width: '100%' }}>
          <Controller
            name={field.id}
            control={control}
            render={({ field: controllerField }) => (
              <DatePicker
                {...controllerField}
                value={controllerField.value || null}
                label={field.label}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors[field.id],
                    helperText: errors[field.id]?.message,
                    size: 'medium',
                    sx: fieldSx
                  }
                }}
              />
            )}
          />
        </Grid>
      );
    }

    // Time
    if (field.type === 'time') {
      return (
        <Grid key={field.id} item xs={12} sx={{ width: '100%' }}>
          <Controller
            name={field.id}
            control={control}
            render={({ field: controllerField }) => (
              <TimePicker
                {...controllerField}
                value={controllerField.value || null}
                label={field.label}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors[field.id],
                    helperText: errors[field.id]?.message,
                    size: 'medium',
                    sx: fieldSx
                  }
                }}
              />
            )}
          />
        </Grid>
      );
    }

    // Dropdown
    if (field.type === 'dropdown') {
      let options = [];
      if (field.useGlobalOptions && dropdowns[field.useGlobalOptions]) {
        options = dropdowns[field.useGlobalOptions];
      } else if (field.options) {
        options = field.options.split(',').map(s => s.trim());
      }

      return (
        <Grid key={field.id} item xs={12} sx={{ width: '100%' }}>
          <Controller
            name={field.id}
            control={control}
            render={({ field: controllerField }) => (
              <TextField
                select
                fullWidth
                size="medium"
                label={field.label}
                {...controllerField}
                value={controllerField.value || ''}
                error={!!errors[field.id]}
                helperText={errors[field.id]?.message}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {getIconForField(field)}
                    </InputAdornment>
                  ),
                }}
              >
                {options.map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
      );
    }

    // Text / Number / Decimal / Long Text
    return (
      <Grid key={field.id} item xs={12} sx={{ width: '100%' }}>
        <Controller
          name={field.id}
          control={control}
          render={({ field: controllerField }) => (
            <TextField
              fullWidth
              size="medium"
              label={field.label}
              type={isNumber ? 'number' : 'text'}
              multiline={isLongText}
              minRows={isLongText ? 3 : 1}
              inputProps={field.type === 'decimal' ? { step: "0.01" } : {}}
              {...controllerField}
              value={controllerField.value || ''}
              error={!!errors[field.id]}
              helperText={errors[field.id]?.message}
              sx={isLongText ? {
                ...fieldSx,
                '& .MuiInputBase-root': { height: 'auto', minHeight: 54, alignItems: 'flex-start' },
                '& .MuiOutlinedInput-input': { padding: '14px 14px' }
              } : fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={isLongText ? { mt: '16px' } : {}}>
                    {getIconForField(field)}
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
      </Grid>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}
      scroll="paper"
    >
      <DialogTitle sx={{
        bgcolor: 'primary.main',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        {initialData ? 'Edit History Record' : 'Add Service Record'}
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          p: 3,
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-track': { background: '#f1f1f1' },
          '&::-webkit-scrollbar-thumb': { background: '#1976d2', borderRadius: '4px' },
          '&::-webkit-scrollbar-thumb:hover': { background: '#1565c0' },
        }}
      >
        <form id="record-form" onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            {/* Fixed Fields: Date & Activity - Full Width */}
            <Grid item xs={12} sx={{ width: '100%' }}>
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
                        helperText: errors.date?.message,
                        size: 'medium',
                        sx: fieldSx
                      }
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
              <Controller
                name="activity"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    size="medium"
                    label="Activity Type"
                    {...field}
                    error={!!errors.activity}
                    helperText={errors.activity?.message}
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <TimelineIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {(dropdowns.activityTypes || []).map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>

            {loadingConfig && (
              <Grid item xs={12} display="flex" justifyContent="center">
                <CircularProgress size={24} />
              </Grid>
            )}

            {/* Divider for Dynamic Fields */}
            {!loadingConfig && selectedActivity && fieldsConfig.length > 0 && (
              <Grid item xs={12} sx={{ width: '100%' }}>
                <Divider textAlign="center" sx={{ my: 2, width: '100%' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
                    DETAILS
                  </Typography>
                </Divider>
              </Grid>
            )}

            {!loadingConfig && selectedActivity && fieldsConfig.map(field => renderDynamicField(field))}
          </Grid>
        </form>
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: '#f9f9f9', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, flexShrink: 0 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          type="submit"
          form="record-form"
          variant="contained"
          size="large"
          sx={{ minWidth: 120, borderRadius: 2 }}
        >
          Save Record
        </Button>
      </DialogActions>
    </Dialog>
  );
}