import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Box,
  InputAdornment,
  IconButton,
  Switch,
  FormControlLabel,
  Typography
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useSnackbar } from 'notistack';

// Icons for "Eye Catching" UI
import CloseIcon from '@mui/icons-material/Close';
import TagIcon from '@mui/icons-material/Tag';         // Roller Number
import BusinessIcon from '@mui/icons-material/Business'; // Make
import FactoryIcon from '@mui/icons-material/Factory';   // Line
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'; // Position
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import CommentIcon from '@mui/icons-material/Comment';

const schema = yup.object().shape({
  rollerNumber: yup.string().required("Roller Number is required"),
  make: yup.string().required("Manufacturer Make is required"),
  position: yup.string().oneOf(['Top', 'Bottom']).required("Position is required"),
  line: yup.string().oneOf(['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2']).required("Production Line is required"),
  mailAlertsEnabled: yup.boolean().default(true),
  alertDisableReason: yup.string().when('mailAlertsEnabled', {
    is: false,
    then: (s) => s.trim().required("Reason for disabling alerts is required"),
    otherwise: (s) => s.notRequired().nullable(),
  }),
});

export default function RollerForm({ open, onClose, initialData }) {
  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      rollerNumber: '',
      make: '',
      position: 'Top',
      line: '',
      mailAlertsEnabled: true,
      alertDisableReason: ''
    }
  });

  const mailAlertsEnabled = watch('mailAlertsEnabled');
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (initialData) {
      reset({
        rollerNumber: initialData.rollerNumber || '',
        make: initialData.make || '',
        position: initialData.position || 'Top',
        line: initialData.line || '',
        mailAlertsEnabled: initialData.mailAlertsEnabled !== false,
        alertDisableReason: initialData.alertDisableReason || ''
      });
    } else {
      reset({
        rollerNumber: '',
        make: '',
        position: 'Top',
        line: '',
        mailAlertsEnabled: true,
        alertDisableReason: ''
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = async (data) => {
    try {
      const isAlertEnabled = data.mailAlertsEnabled !== false;
      const payload = {
        ...data,
        mailAlertsEnabled: isAlertEnabled,
        alertDisableReason: isAlertEnabled ? '' : (data.alertDisableReason || '').trim(),
      };

      if (initialData) {
        if (initialData.mailAlertsEnabled !== isAlertEnabled) {
          payload.alertStatusUpdatedAt = serverTimestamp();
          payload.alertStatusUpdatedBy = auth.currentUser?.uid || 'Unknown';
        }
        await updateDoc(doc(db, 'rollers', initialData.id), payload);
        enqueueSnackbar('Roller updated successfully', { variant: 'success' });
      } else {
        await addDoc(collection(db, 'rollers'), {
          ...payload,
          status: 'Pending',
          createdBy: auth.currentUser?.uid || 'Unknown',
          createdAt: serverTimestamp()
        });
        enqueueSnackbar('New Roller created', { variant: 'success' });
      }
      onClose();
    } catch (err) {
      enqueueSnackbar('Error saving: ' + err.message, { variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: { borderRadius: 3 } // Rounded corners for the modal
      }}
    >
      {/* Header Section */}
      <DialogTitle sx={{
        bgcolor: 'primary.main',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {initialData ? 'Edit Roller Details' : 'Register New Roller'}
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ mt: 1 }}>
            <Stack spacing={3}>

              {/* Roller Number (Primary ID) */}
              <Controller
                name="rollerNumber"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Roller Number"
                    fullWidth
                    placeholder="e.g. R-2025-001"
                    error={!!errors.rollerNumber}
                    helperText={errors.rollerNumber?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <TagIcon color="primary" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              {/* Make (Physical Attributes) */}
              <Controller
                name="make"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Make / Manufacturer"
                    fullWidth
                    error={!!errors.make}
                    helperText={errors.make?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="Fickert">Fickert</MenuItem>
                    <MenuItem value="Rurex">Rurex</MenuItem>
                    <MenuItem value="Rurex/Fickert">Rurex/Fickert</MenuItem>
                  </TextField>
                )}
              />

              {/* Location Attributes */}
              <Controller
                name="line"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Production Line"
                    placeholder='e.g. Line A'
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FactoryIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="SG#1">SG#1</MenuItem>
                    <MenuItem value="SG#2">SG#2</MenuItem>
                    <MenuItem value="SG#3.1">SG#3.1</MenuItem>
                    <MenuItem value="SG#3.2">SG#3.2</MenuItem>
                  </TextField>
                )}
              />

              <Controller
                name="position"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Roller Position"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VerticalAlignTopIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="Top">Top</MenuItem>
                    <MenuItem value="Bottom">Bottom</MenuItem>
                  </TextField>
                )}
              />

              {/* Mail Alert Settings */}
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: mailAlertsEnabled ? '#90caf9' : '#ffb74d',
                  borderRadius: 2,
                  bgcolor: mailAlertsEnabled ? 'rgba(25, 118, 210, 0.04)' : 'rgba(237, 108, 2, 0.06)',
                  transition: 'all 0.25s ease-in-out'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {mailAlertsEnabled ? (
                      <NotificationsActiveIcon color="primary" />
                    ) : (
                      <NotificationsOffIcon color="warning" />
                    )}
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Mail Alerts
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {mailAlertsEnabled
                          ? 'Alert emails are enabled for this roller'
                          : 'Alert emails are disabled for this roller'}
                      </Typography>
                    </Box>
                  </Box>

                  <Controller
                    name="mailAlertsEnabled"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ color: field.value ? 'primary.main' : 'warning.main', minWidth: 60 }}
                          >
                            {field.value ? 'Enabled' : 'Disabled'}
                          </Typography>
                        }
                        labelPlacement="start"
                        sx={{ m: 0 }}
                      />
                    )}
                  />
                </Box>

                {!mailAlertsEnabled && (
                  <Box sx={{ mt: 2 }}>
                    <Controller
                      name="alertDisableReason"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Reason for Disabling Alerts *"
                          multiline
                          rows={2}
                          fullWidth
                          required
                          placeholder="e.g. Special pattern roller not in current production"
                          error={!!errors.alertDisableReason}
                          helperText={errors.alertDisableReason?.message || "Please provide a reason before saving"}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="top" sx={{ mt: 1 }}>
                                <CommentIcon color="warning" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: '#f9f9f9', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            sx={{ minWidth: 120, borderRadius: 2 }}
          >
            {initialData ? 'Update' : 'Save Roller'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}