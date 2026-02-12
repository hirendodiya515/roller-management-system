import React, { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Box,
    CircularProgress,
    Button
} from '@mui/material';
import { collectionGroup, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format } from 'date-fns';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { jsPDF } from 'jspdf';
import JobCardForm from '../components/JobCardForm';
import { useNavigate } from 'react-router-dom';

export default function JobCards() {
    const [jobCards, setJobCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openJobCard, setOpenJobCard] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobCards = async () => {
            try {
                const jobCardQuery = query(
                    collectionGroup(db, 'records'),
                    where('activity', '==', 'Roller sent'),
                    orderBy('date', 'desc')
                );
                const querySnapshot = await getDocs(jobCardQuery);
                const cardPromises = querySnapshot.docs.map(async (recordDoc) => {
                    const recordData = recordDoc.data();
                    const recordId = recordDoc.id;
                    const rollerRef = recordDoc.ref.parent.parent;
                    let rollerData = { rollerNumber: 'Unknown', line: '-', position: '-' };
                    
                    if (rollerRef) {
                        const rollerSnap = await getDoc(rollerRef);
                        if (rollerSnap.exists()) {
                            rollerData = rollerSnap.data();
                        }
                    }
                    
                    // Also fetch job card data for RGP No display
                    let jobCardInfo = {};
                    const jobCardSnap = await getDoc(doc(db, 'jobCards', recordId));
                    if (jobCardSnap.exists()) {
                        jobCardInfo = jobCardSnap.data().formData || {};
                    }
                    
                    return {
                        id: recordId,
                        rollerId: rollerRef ? rollerRef.id : null,
                        ...recordData,
                        rollerNumber: rollerData.rollerNumber,
                        line: rollerData.line,
                        position: rollerData.position,
                        rgpNo: jobCardInfo.rgpNo || '-',
                        reasonForSending: jobCardInfo.reasonForSending || '-'
                    };
                });
                const fetchedCards = await Promise.all(cardPromises);
                setJobCards(fetchedCards);
            } catch (error) {
                console.error('Error fetching job cards:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchJobCards();
    }, [openJobCard]);

    const handleJobCardClick = (record) => {
        setSelectedRecord(record);
        setOpenJobCard(true);
    };

    const handleExportPdf = async (record) => {
        try {
            const jobCardSnap = await getDoc(doc(db, 'jobCards', record.id));
            const jobCardData = jobCardSnap.exists() ? jobCardSnap.data() : null;
            const formData = jobCardData?.formData || {};
            
            const pdf = new jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            
            // Draw page border
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.rect(margin - 5, margin - 5, pageWidth - 2 * (margin - 5), pageHeight - 2 * (margin - 5));
            
            // Header Section
            pdf.setFillColor(240, 240, 240);
            pdf.rect(margin, margin, pageWidth - 2 * margin, 35, 'F');
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('BOROSIL', margin + 5, margin + 10);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Renewables Ltd.', margin + 5, margin + 15);
            
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('JOB CARD', pageWidth / 2, margin + 15, { align: 'center' });
            
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            const dateStr = formData.date || '-';
            pdf.text(`Date: ${dateStr}`, pageWidth - margin - 5, margin + 10, { align: 'right' });
            pdf.text(`RGP No: ${formData.rgpNo || '-'}`, pageWidth - margin - 5, margin + 15, { align: 'right' });
            
            // Roller Information Section
            let yPos = margin + 45;
            pdf.setFillColor(230, 230, 230);
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 32, 'F');
            
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Roller Information', margin + 5, yPos + 7);
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Roller Number: ${formData.rollerNumber || record.rollerNumber}`, margin + 5, yPos + 14);
            pdf.text(`Production Line: ${formData.line || record.line}`, margin + 5, yPos + 21);
            pdf.text(`Position: ${formData.position || record.position}`, margin + 5, yPos + 28);
            
            // Job Card Details Section
            yPos += 42;
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Job Card Details', margin + 5, yPos);
            
            yPos += 10;
            pdf.setFontSize(10);
            
            const fields = [
                { label: 'Reason for Sending', value: formData.reasonForSending },
                { label: 'Specify if any other', value: formData.specifyOther },
                { label: 'Ra Required', value: formData.raRequired },
                { label: 'Rz Required', value: formData.rzRequired },
                { label: 'Additional Requirement/Feedback', value: formData.additionalFeedback }
            ];
            
            fields.forEach(({ label, value }) => {
                pdf.setFillColor(250, 250, 250);
                pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 12, 'F');
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${label}:`, margin + 5, yPos);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${value || 'N/A'}`, margin + 70, yPos);
                yPos += 14;
            });
            
            // Footer Section
            const footerY = pageHeight - margin - 15;
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.3);
            pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
            
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'italic');
            pdf.text('This is a computer-generated report. No signature is required.', pageWidth / 2, footerY, { align: 'center' });
            
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Generated by Roller Management System', margin, footerY + 5);
            pdf.text('Page 1 of 1', pageWidth - margin, footerY + 5, { align: 'right' });
            
            pdf.save(`Job_Card_RGP_${formData.rgpNo || record.id.substring(0, 8)}_${record.rollerNumber}.pdf`);
        } catch (err) {
            console.error('Error generating PDF', err);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/')}
                variant="outlined"
                size="medium"
                sx={{ borderRadius: 2 }}
              >
                Back to Dashboard
              </Button>
            </Box>
            <Box display="flex" alignItems="center" mb={4}>
                <AssignmentIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4" fontWeight="bold" color="primary">
                    Job Cards
                </Typography>
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>RGP No.</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Roller #</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Line</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Reason</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date Sent</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : jobCards.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">No job cards found.</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            jobCards.map((row) => (
                                <TableRow key={row.id} hover>
                                    <TableCell>
                                        <Typography fontWeight="bold">
                                            {row.rgpNo !== '-' ? row.rgpNo : '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="subtitle2"
                                            fontWeight="bold"
                                            color="primary"
                                            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                                            onClick={() => navigate(`/roller/${row.rollerId}`)}
                                        >
                                            #{row.rollerNumber}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{row.line}</TableCell>
                                    <TableCell sx={{ maxWidth: 200 }}>
                                        <Typography noWrap title={row.reasonForSending}>
                                            {row.reasonForSending !== '-' ? row.reasonForSending : '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{row.date?.seconds ? format(new Date(row.date.seconds * 1000), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={row.jobCardStatus === 'Saved' ? 'Completed' : 'Pending'}
                                            color={row.jobCardStatus === 'Saved' ? 'success' : 'warning'}
                                            size="small"
                                            variant={row.jobCardStatus === 'Saved' ? 'filled' : 'outlined'}
                                            sx={{ fontWeight: 'bold' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant={row.jobCardStatus === 'Saved' ? "outlined" : "contained"}
                                            color={row.jobCardStatus === 'Saved' ? "success" : "primary"}
                                            size="small"
                                            startIcon={<AssignmentIcon />}
                                            onClick={() => handleJobCardClick(row)}
                                        >
                                            {row.jobCardStatus === 'Saved' ? "View" : "Create"}
                                        </Button>
                                        {row.jobCardStatus === 'Saved' && (
                                            <Button
                                                variant="outlined"
                                                color="secondary"
                                                size="small"
                                                startIcon={<PictureAsPdfIcon />}
                                                onClick={() => handleExportPdf(row)}
                                                sx={{ ml: 1 }}
                                            >
                                                Export PDF
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <JobCardForm
                open={openJobCard}
                onClose={() => { setOpenJobCard(false); setSelectedRecord(null); }}
                recordId={selectedRecord?.id}
                rollerId={selectedRecord?.rollerId}
            />
        </Container>
    );
}
