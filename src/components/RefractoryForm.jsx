import React, { useEffect, useMemo } from 'react';
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
  Grid
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useSnackbar } from 'notistack';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import FactoryIcon from '@mui/icons-material/Factory';
import NumbersIcon from '@mui/icons-material/Numbers';
import BusinessIcon from '@mui/icons-material/Business';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import DescriptionIcon from '@mui/icons-material/Description';
import QrCodeIcon from '@mui/icons-material/QrCode';
import StraightenIcon from '@mui/icons-material/Straighten';

const schema = yup.object().shape({
  type: yup.string().required("Refractory Type is required"),
  furnaceType: yup.string().required("Furnace Type is required"),
  line: yup.string().optional(),
  units: yup.number()
    .typeError("Units must be a number")
    .required("Units count is required")
    .min(0, "Units cannot be negative")
    .integer("Units must be an integer"),
  initialUnits: yup.number()
    .typeError("Initial units must be a number")
    .optional()
    .min(1, "Initial units must be greater than zero"),
  unit: yup.string().optional(),
  materialCode: yup.string().optional(),
  supplierName: yup.string().optional(),
  description: yup.string().optional(),
});

const furnaceLineMap = {
  'Cross fired': ['SG#3', 'SG#3.1', 'SG#3.2'],
  'End fired': ['SG#1', 'SG#2']
};

export default function RefractoryForm({ open, onClose, dropdowns, editData = null }) {
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { type: '', furnaceType: '', line: '', units: 1, initialUnits: 1, unit: 'Pcs', materialCode: '', supplierName: '', description: '' }
  });

  const { enqueueSnackbar } = useSnackbar();

  const selectedFurnaceType = watch('furnaceType');
  const selectedLine = watch('line');

  const refractoryTypesOptions = dropdowns?.refractoryTypes || ['Lip block', 'Moving block', 'Overflow block', 'Flat arc'];
  const furnaceTypesOptions = dropdowns?.furnaceTypes || ['Cross fired', 'End fired'];
  const allLineOptions = dropdowns?.lines || ['SG#1', 'SG#2', 'SG#3', 'SG#3.1', 'SG#3.2'];
  const unitOptions = dropdowns?.refractoryUnits || ['Set', 'Nos'];

  // Filter lines based on selected furnace type
  const filteredLineOptions = useMemo(() => {
    if (selectedFurnaceType && furnaceLineMap[selectedFurnaceType]) {
      const allowedLines = furnaceLineMap[selectedFurnaceType];
      return allLineOptions.filter(l => allowedLines.includes(l));
    }
    return allLineOptions;
  }, [selectedFurnaceType, allLineOptions]);

  // Clear line if current selected line is not valid for furnace type, or auto-set SG#3 for Cross fired
  useEffect(() => {
    if (selectedFurnaceType === 'Cross fired' && !selectedLine) {
      setValue('line', 'SG#3');
    } else if (selectedLine && !filteredLineOptions.includes(selectedLine)) {
      setValue('line', '');
    }
  }, [selectedFurnaceType, selectedLine, filteredLineOptions, setValue]);

  useEffect(() => {
    if (open) {
      if (editData) {
        reset({
          type: editData.type || '',
          furnaceType: editData.furnaceType || '',
          line: editData.line || '',
          units: editData.units ?? 1,
          initialUnits: editData.initialUnits ?? editData.units ?? 1,
          unit: editData.unit || unitOptions[0] || 'Set',
          materialCode: editData.materialCode || '',
          supplierName: editData.supplierName || '',
          description: editData.description || ''
        });
      } else {
        reset({ type: '', furnaceType: '', line: '', units: 1, initialUnits: 1, unit: unitOptions[0] || 'Set', materialCode: '', supplierName: '', description: '' });
      }
    }
  }, [open, editData, reset, unitOptions]);

  const onSubmit = async (data) => {
    try {
      if (editData) {
        const docRef = doc(db, 'refractories', editData.id);
        const newInitialUnits = Number(data.initialUnits || data.units);
        await updateDoc(docRef, {
          type: data.type,
          furnaceType: data.furnaceType,
          line: data.line || '',
          units: Number(data.units),
          initialUnits: newInitialUnits,
          unit: data.unit || 'Set',
          materialCode: data.materialCode || '',
          supplierName: data.supplierName || '',
          description: data.description || '',
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || 'Unknown'
        });
        enqueueSnackbar('Refractory stock updated successfully', { variant: 'success' });
      } else {
        await addDoc(collection(db, 'refractories'), {
          type: data.type,
          furnaceType: data.furnaceType,
          line: data.line || '',
          units: Number(data.units),
          initialUnits: Number(data.units),
          unit: data.unit || 'Set',
          materialCode: data.materialCode || '',
          supplierName: data.supplierName || '',
          description: data.description || '',
          createdBy: auth.currentUser?.email || 'Unknown',
          createdAt: serverTimestamp()
        });
        enqueueSnackbar('Refractory stock added successfully', { variant: 'success' });
      }
      onClose();
    } catch (err) {
      enqueueSnackbar('Error saving refractory: ' + err.message, { variant: 'error' });
    }
  };

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
        bgcolor: editData ? 'secondary.main' : 'primary.main',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {editData ? 'Edit Refractory Stock' : 'Add Refractory Stock'}
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

              {/* Furnace Type Select (Required) */}
              <Controller
                name="furnaceType"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Furnace Type *"
                    fullWidth
                    error={!!errors.furnaceType}
                    helperText={errors.furnaceType?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocalFireDepartmentIcon color="error" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {furnaceTypesOptions.map((ft) => (
                      <MenuItem key={ft} value={ft}>
                        {ft}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              {/* Line Select (Optional, filtered by Furnace Type) */}
              <Controller
                name="line"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Production Line (Optional)"
                    fullWidth
                    error={!!errors.line}
                    helperText={
                      errors.line?.message ||
                      (selectedFurnaceType
                        ? `Showing lines for ${selectedFurnaceType}`
                        : "Select furnace type to filter lines")
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FactoryIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="">
                      <em>None / Unassigned</em>
                    </MenuItem>
                    {filteredLineOptions.map((line) => (
                      <MenuItem key={line} value={line}>
                        {line}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              {/* Material Code Input (Optional) */}
              <Controller
                name="materialCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Material Code (Optional)"
                    fullWidth
                    placeholder="Enter material / SAP code"
                    error={!!errors.materialCode}
                    helperText={errors.materialCode?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <QrCodeIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              {/* Quantity (Units) & Unit of Measure side by side */}
              <Grid container spacing={2}>
                <Grid item xs={7}>
                  <Controller
                    name="units"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        label="Quantity *"
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
                </Grid>
                <Grid item xs={5}>
                  <Controller
                    name="unit"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Unit"
                        fullWidth
                        error={!!errors.unit}
                        helperText={errors.unit?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <StraightenIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      >
                        {unitOptions.map((u) => (
                          <MenuItem key={u} value={u}>
                            {u}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              </Grid>

              {/* Supplier Name Input (Optional) */}
              <Controller
                name="supplierName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Supplier Name (Optional)"
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

              {/* Description Input (Optional) */}
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description (Optional)"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Enter description or notes..."
                    error={!!errors.description}
                    helperText={errors.description?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DescriptionIcon color="action" />
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
            color={editData ? 'secondary' : 'primary'}
            size="large"
            sx={{ minWidth: 120, borderRadius: 2 }}
          >
            {editData ? 'Update Stock' : 'Add Stock'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
