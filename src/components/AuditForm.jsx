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
    Grid,
    Alert
} from '@mui/material';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const QUESTIONS = [
    { id: 'runOut', label: 'Roller run-out in mm', type: 'number', required: true },
    { id: 'shaftRoughness', label: 'DU shaft roughness in micrometer', type: 'number', required: true },
    { id: 'shaftDiameter', label: 'DU shaft diameter in mm', type: 'number', required: true },
    { id: 'mountingPosition', label: "DU shaft's mounting position", type: 'text', required: true },
    { id: 'placeholder1', label: 'Additional Check 1', type: 'text', required: false },
    { id: 'placeholder2', label: 'Additional Check 2', type: 'text', required: false },
    //add more question here for PDI 
];

export default function AuditForm({ open, onClose, recordId, rollerId }) {
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { currentUser } = useAuth();

    useEffect(() => {
        if (open && recordId) {
            setLoading(true);
            const fetchAudit = async () => {
                try {
                    const docRef = doc(db, 'audits', recordId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setAnswers(docSnap.data().questions || {});
                    } else {
                        setAnswers({});
                    }
                } catch (err) {
                    console.error("Error fetching audit:", err);
                    setError("Failed to load audit data.");
                } finally {
                    setLoading(false);
                }
            };
            fetchAudit();
        }
    }, [open, recordId]);

    const handleChange = (id, value) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
    };

    const handleSave = async () => {
        // Validation
        const missing = QUESTIONS.filter(q => q.required && !answers[q.id]);
        if (missing.length > 0) {
            setError(`Please fill in all required fields: ${missing.map(q => q.label).join(', ')}`);
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Save Audit Data
            const auditData = {
                rollerId,
                recordId,
                questions: answers,
                savedAt: new Date(),
                savedBy: currentUser.uid
            };
            await setDoc(doc(db, 'audits', recordId), auditData);

            // 2. Update Record Status
            await updateDoc(doc(db, `rollers/${rollerId}/records`, recordId), {
                auditStatus: 'Saved'
            });

            onClose();
        } catch (err) {
            console.error("Error saving audit:", err);
            setError("Failed to save audit data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ bgcolor: '#f5f5f5', pb: 1 }}>
                Roller PDI Audit
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    {QUESTIONS.map((q) => (
                        <Grid item xs={12} key={q.id}>
                            <TextField
                                fullWidth
                                label={q.label}
                                type={q.type === 'number' ? 'number' : 'text'}
                                value={answers[q.id] || ''}
                                onChange={(e) => handleChange(q.id, e.target.value)}
                                required={q.required}
                                variant="outlined"
                                size="small"
                                inputProps={q.type === 'number' ? { step: "0.001" } : {}}
                            />
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save Audit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
