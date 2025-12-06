import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert,
    MenuItem,
    FormControl,
    Select
} from '@mui/material';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

// Dropdown options for "Reason for sending"
const REASON_OPTIONS = [
    'De-chrome & Chrome only',
    'De-chrome & Chrome + Metalizing (Shaft Repairing)',
    'Only metalizing',
    'De-chrome & Chrome, Re-Engraving + Metalizing (Shaft Repairing)',
    'Re-Engraving only'
];

// FormRow component defined OUTSIDE to prevent re-renders
const FormRow = ({ label, children, required }) => (
    <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        py: 1.5, 
        borderBottom: '1px solid #e0e0e0',
        '&:last-child': { borderBottom: 'none' }
    }}>
        <Typography 
            sx={{ 
                width: 180, 
                flexShrink: 0, 
                fontWeight: 500, 
                color: '#555',
                fontSize: '0.9rem'
            }}
        >
            {label}{required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
        <Box sx={{ flex: 1 }}>
            {children}
        </Box>
    </Box>
);

export default function JobCardForm({ open, onClose, recordId, rollerId }) {
    const [formData, setFormData] = useState({
        rgpNo: '',
        rollerNumber: '',
        date: '',
        position: '',
        line: '',
        reasonForSending: '',
        specifyOther: '',
        raRequired: '',
        rzRequired: '',
        additionalFeedback: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { currentUser } = useAuth();

    useEffect(() => {
        if (open && recordId) {
            setLoading(true);
            const fetchData = async () => {
                try {
                    const jobCardRef = doc(db, 'jobCards', recordId);
                    const jobCardSnap = await getDoc(jobCardRef);
                    
                    let rollerInfo = { rollerNumber: '', line: '', position: '' };
                    let recordInfo = { date: '' };
                    
                    if (rollerId) {
                        const rollerRef = doc(db, 'rollers', rollerId);
                        const rollerSnap = await getDoc(rollerRef);
                        if (rollerSnap.exists()) {
                            const data = rollerSnap.data();
                            rollerInfo = {
                                rollerNumber: data.rollerNumber || '',
                                line: data.line || '',
                                position: data.position || ''
                            };
                        }
                        
                        const recordRef = doc(db, `rollers/${rollerId}/records`, recordId);
                        const recordSnap = await getDoc(recordRef);
                        if (recordSnap.exists()) {
                            const recData = recordSnap.data();
                            if (recData.date?.seconds) {
                                recordInfo.date = format(new Date(recData.date.seconds * 1000), 'yyyy-MM-dd');
                            }
                        }
                    }
                    
                    if (jobCardSnap.exists()) {
                        const savedData = jobCardSnap.data().formData || {};
                        setFormData({
                            rgpNo: savedData.rgpNo || '',
                            rollerNumber: savedData.rollerNumber || rollerInfo.rollerNumber,
                            date: savedData.date || recordInfo.date,
                            position: savedData.position || rollerInfo.position,
                            line: savedData.line || rollerInfo.line,
                            reasonForSending: savedData.reasonForSending || '',
                            specifyOther: savedData.specifyOther || '',
                            raRequired: savedData.raRequired || '',
                            rzRequired: savedData.rzRequired || '',
                            additionalFeedback: savedData.additionalFeedback || ''
                        });
                    } else {
                        setFormData({
                            rgpNo: '',
                            rollerNumber: rollerInfo.rollerNumber,
                            date: recordInfo.date,
                            position: rollerInfo.position,
                            line: rollerInfo.line,
                            reasonForSending: '',
                            specifyOther: '',
                            raRequired: '',
                            rzRequired: '',
                            additionalFeedback: ''
                        });
                    }
                } catch (err) {
                    console.error("Error fetching job card:", err);
                    setError("Failed to load job card data.");
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [open, recordId, rollerId]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!formData.rgpNo) {
            setError('RGP No. is required');
            return;
        }
        if (isNaN(parseInt(formData.rgpNo))) {
            setError('RGP No. must be a valid integer');
            return;
        }
        if (!formData.reasonForSending) {
            setError('Reason for sending is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const jobCardData = {
                rollerId,
                recordId,
                formData: {
                    rgpNo: parseInt(formData.rgpNo),
                    rollerNumber: formData.rollerNumber,
                    date: formData.date,
                    position: formData.position,
                    line: formData.line,
                    reasonForSending: formData.reasonForSending,
                    specifyOther: formData.specifyOther,
                    raRequired: formData.raRequired ? parseFloat(formData.raRequired) : null,
                    rzRequired: formData.rzRequired ? parseFloat(formData.rzRequired) : null,
                    additionalFeedback: formData.additionalFeedback
                },
                savedAt: new Date(),
                savedBy: currentUser.uid
            };
            await setDoc(doc(db, 'jobCards', recordId), jobCardData);

            await updateDoc(doc(db, `rollers/${rollerId}/records`, recordId), {
                jobCardStatus: 'Saved'
            });

            onClose();
        } catch (err) {
            console.error("Error saving job card:", err);
            setError("Failed to save job card data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>
                Job Card
            </DialogTitle>
            <DialogContent sx={{ pt: 2, pb: 1 }}>
                {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

                {/* Roller Info Section */}
                <Typography variant="subtitle2" sx={{ 
                    bgcolor: '#f5f5f5', 
                    px: 2, 
                    py: 1, 
                    mt: 1,
                    borderRadius: 1,
                    fontWeight: 'bold',
                    color: '#1976d2'
                }}>
                    ROLLER INFORMATION
                </Typography>
                <Box sx={{ px: 1, mb: 2 }}>
                    <FormRow label="Roller Number">
                        <Typography fontWeight="bold">{formData.rollerNumber || '-'}</Typography>
                    </FormRow>
                    <FormRow label="Production Line">
                        <Typography>{formData.line || '-'}</Typography>
                    </FormRow>
                    <FormRow label="Roller Position">
                        <Typography>{formData.position || '-'}</Typography>
                    </FormRow>
                    <FormRow label="Date">
                        <Typography>{formData.date || '-'}</Typography>
                    </FormRow>
                </Box>

                {/* Job Card Details Section */}
                <Typography variant="subtitle2" sx={{ 
                    bgcolor: '#f5f5f5', 
                    px: 2, 
                    py: 1,
                    borderRadius: 1,
                    fontWeight: 'bold',
                    color: '#1976d2'
                }}>
                    JOB CARD DETAILS
                </Typography>
                <Box sx={{ px: 1 }}>
                    <FormRow label="RGP No." required>
                        <TextField
                            fullWidth
                            type="number"
                            value={formData.rgpNo}
                            onChange={(e) => handleChange('rgpNo', e.target.value)}
                            size="small"
                            placeholder="Enter RGP Number"
                            inputProps={{ step: 1 }}
                        />
                    </FormRow>

                    <FormRow label="Reason for Sending" required>
                        <FormControl fullWidth size="small">
                            <Select
                                value={formData.reasonForSending}
                                onChange={(e) => handleChange('reasonForSending', e.target.value)}
                                displayEmpty
                            >
                                <MenuItem value="" disabled>Select Reason</MenuItem>
                                {REASON_OPTIONS.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </FormRow>

                    <FormRow label="Specify if any other">
                        <TextField
                            fullWidth
                            value={formData.specifyOther}
                            onChange={(e) => handleChange('specifyOther', e.target.value)}
                            size="small"
                            placeholder="Enter details if other reason"
                        />
                    </FormRow>

                    <FormRow label="Ra Required">
                        <TextField
                            fullWidth
                            type="number"
                            value={formData.raRequired}
                            onChange={(e) => handleChange('raRequired', e.target.value)}
                            size="small"
                            placeholder="e.g., 0.25"
                            inputProps={{ step: 0.01 }}
                        />
                    </FormRow>

                    <FormRow label="Rz Required">
                        <TextField
                            fullWidth
                            type="number"
                            value={formData.rzRequired}
                            onChange={(e) => handleChange('rzRequired', e.target.value)}
                            size="small"
                            placeholder="e.g., 1.50"
                            inputProps={{ step: 0.01 }}
                        />
                    </FormRow>

                    <FormRow label="Additional Feedback">
                        <TextField
                            fullWidth
                            value={formData.additionalFeedback}
                            onChange={(e) => handleChange('additionalFeedback', e.target.value)}
                            size="small"
                            multiline
                            rows={2}
                            placeholder="Enter any additional requirements..."
                        />
                    </FormRow>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save Job Card'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
