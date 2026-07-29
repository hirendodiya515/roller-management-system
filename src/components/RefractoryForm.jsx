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
  IconButton
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useSnackbar } from 'notistack';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import FactoryIcon from '@mui/icons-material/Factory';
import NumbersIcon from '@mui/icons-material/Numbers';
import BusinessIcon from '@mui/icons-material/Business';

const schema = yup.object().shape({
  type: yup.string().required("Refractory Type is required"),
  line: yup.string().required("Production Line is required"),
  units: yup.number()
    .typeError("Units must be a number")
    .required("Units count is required")
    .positive("Units must be greater than zero")
    .integer("Units must be an integer"),
  supplierName: yup.string().required("Supplier Name is required"),
});

export default function RefractoryForm({ open, onClose, dropdowns }) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { type: '', line: '', units: 1, supplierName: '' }
  });

  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      reset({ type: '', line: '', units: 1, supplierName: '' });
    }
  }, [open, reset]);

  const onSubmit = async (data) => {
    try {
      await addDoc(collection(db, 'refractories'), {
        type: data.type,
        line: data.line,
        units: Number(data.units),
        initialUnits: Number(data.units),
        supplierName: data.supplierName,
        createdBy: auth.currentUser?.email || 'Unknown',
        createdAt: serverTimestamp()
      });
      enqueueSnackbar('Refractory stock added successfully', { variant: 'success' });
      onClose();
    } catch (err) {
      enqueueSnackbar('Error saving refractory: ' + err.message, { variant: 'error' });
    }
  };

  const refractoryTypesOptions = dropdowns?.refractoryTypes || ['Lip block', 'Moving block', 'Overflow block', 'Flat arc'];
  const lineOptions = dropdowns?.lines || ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2'];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{
        bgcolor: 'primary.main',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        Add Refractory Stock
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ mt: 1 }}>
            <Stack spacing={3}>
              {/* Type Select */}
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Refractory Type"
                    fullWidth
                    error={!!errors.type}
                    helperText={errors.type?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CategoryIcon color="primary" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {refractoryTypesOptions.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              {/* Line Select */}
              <Controller
                name="line"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Production Line"
                    fullWidth
                    error={!!errors.line}
                    helperText={errors.line?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FactoryIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {lineOptions.map((line) => (
                      <MenuItem key={line} value={line}>
                        {line}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              {/* Units Input */}
              <Controller
                name="units"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Quantity (Units)"
                    fullWidth
                    error={!!errors.units}
                    helperText={errors.units?.message}
                    InputProps={{
                      inputProps: { min: 1 },
                      startAdornment: (
                        <InputAdornment position="start">
                          <NumbersIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              {/* Supplier Name Input */}
              <Controller
                name="supplierName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Supplier Name"
                    fullWidth
                    placeholder="Enter supplier name"
                    error={!!errors.supplierName}
                    helperText={errors.supplierName?.message}
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
            Add Stock
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
