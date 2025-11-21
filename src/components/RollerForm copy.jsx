import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Grid } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useSnackbar } from 'notistack';

const schema = yup.object().shape({
  rollerNumber: yup.string().required(),
  make: yup.string().required(),
  design: yup.string().required(),
  position: yup.string().oneOf(['Top', 'Bottom']).required(),
  line: yup.string().required(),
});

export default function RollerForm({ open, onClose, initialData }) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { rollerNumber: '', make: '', design: '', position: 'Top', line: '' }
  });
  const { enqueueSnackbar } = useSnackbar();

  React.useEffect(() => {
    if (initialData) reset(initialData);
    else reset({ rollerNumber: '', make: '', design: '', position: 'Top', line: '' });
  }, [initialData, open]);

  const onSubmit = async (data) => {
    try {
      if (initialData) {
        await updateDoc(doc(db, 'rollers', initialData.id), data);
        enqueueSnackbar('Roller updated', { variant: 'success' });
      } else {
        await addDoc(collection(db, 'rollers'), {
          ...data,
          status: 'Pending',
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
        enqueueSnackbar('Roller added successfully', { variant: 'success' });
      }
      onClose();
    } catch (err) {
      enqueueSnackbar('Error saving data: ' + err.message, { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initialData ? 'Edit Roller' : 'Add New Roller'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="rollerNumber" control={control} render={({ field }) => <TextField {...field} label="Roller Number" fullWidth error={!!errors.rollerNumber} helperText={errors.rollerNumber?.message} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
               <Controller name="make" control={control} render={({ field }) => <TextField {...field} label="Make" fullWidth error={!!errors.make} helperText={errors.make?.message} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
               <Controller name="design" control={control} render={({ field }) => <TextField {...field} label="Design" fullWidth error={!!errors.design} helperText={errors.design?.message} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
               <Controller name="line" control={control} render={({ field }) => <TextField {...field} label="Production Line" fullWidth error={!!errors.line} helperText={errors.line?.message} />} />
            </Grid>
            <Grid item xs={12}>
              <Controller 
                name="position" 
                control={control} 
                render={({ field }) => (
                  <TextField {...field} select label="Position" fullWidth>
                    <MenuItem value="Top">Top</MenuItem>
                    <MenuItem value="Bottom">Bottom</MenuItem>
                  </TextField>
                )} 
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}