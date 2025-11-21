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
  IconButton
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
import BrushIcon from '@mui/icons-material/Brush';       // Design
import FactoryIcon from '@mui/icons-material/Factory';   // Line
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'; // Position

const schema = yup.object().shape({
  rollerNumber: yup.string().required("Roller Number is required"),
  make: yup.string().required("Manufacturer Make is required"),
  design: yup.string().required("Design Pattern is required"),
  position: yup.string().oneOf(['Top', 'Bottom']).required("Position is required"),
  //line: yup.string().required("Production Line is required"),
  line: yup.string().oneOf(['SG#1', 'SG#2', 'SG#3.1', 'SG#3,2']).required("Production Line is required"),
});

export default function RollerForm({ open, onClose, initialData }) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { rollerNumber: '', make: '', design: '', position: 'Top', line: '' }
  });

  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (initialData) reset(initialData);
    else reset({ rollerNumber: '', make: '', design: '', position: 'Top', line: '' });
  }, [initialData, open, reset]);

  const onSubmit = async (data) => {
    try {
      if (initialData) {
        await updateDoc(doc(db, 'rollers', initialData.id), data);
        enqueueSnackbar('Roller updated successfully', { variant: 'success' });
      } else {
        await addDoc(collection(db, 'rollers'), {
          ...data,
          status: 'Pending',
          createdBy: auth.currentUser.uid,
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
            <Grid container spacing={3}>

              {/* Row 1: Roller Number (Primary ID) */}
              <Grid item xs={12}>
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
              </Grid>

              {/* Row 2: Make & Design (Physical Attributes) */}
              <Grid item xs={12} sm={6}>
                <Controller
                  name="make"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
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
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="design"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Design Pattern"
                      fullWidth
                      error={!!errors.design}
                      helperText={errors.design?.message}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BrushIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Row 3: Location Attributes */}
              <Grid item xs={12} sm={6}>
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
              </Grid>
              <Grid item xs={12} sm={6}>
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
              </Grid>
            </Grid>
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