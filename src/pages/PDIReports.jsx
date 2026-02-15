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
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { jsPDF } from 'jspdf';
import AuditForm from '../components/AuditForm';
import { useNavigate } from 'react-router-dom';

export default function PDIReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openAudit, setOpenAudit] = useState(false);
    const [selectedAuditRecord, setSelectedAuditRecord] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPDIReports = async () => {
            try {
                const pdiQuery = query(
                    collectionGroup(db, 'records'),
                    where('activity', '==', 'Roller PDI'),
                    orderBy('date', 'desc')
                );
                const querySnapshot = await getDocs(pdiQuery);
                const reportPromises = querySnapshot.docs.map(async (recordDoc) => {
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
                    return {
                        id: recordId,
                        rollerId: rollerRef ? rollerRef.id : null,
                        ...recordData,
                        rollerNumber: rollerData.rollerNumber,
                        line: rollerData.line,
                        position: rollerData.position
                    };
                });
                const fetchedReports = await Promise.all(reportPromises);
                setReports(fetchedReports);
            } catch (error) {
                console.error('Error fetching PDI reports:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPDIReports();
    }, [openAudit]); // Refresh when audit modal closes

    const handleAuditClick = (report) => {
        setSelectedAuditRecord(report);
        setOpenAudit(true);
    };

    const handleExportPdf = async (record) => {
        try {
            // Fetch audit data for the record
            const auditSnap = await getDoc(doc(db, 'audits', record.id));
            const auditData = auditSnap.exists() ? auditSnap.data() : null;

            const pdf = new jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;

            // Draw page border
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.rect(margin - 5, margin - 5, pageWidth - 2 * (margin - 5), pageHeight - 2 * (margin - 5));

            // Header Section with Logo placeholder
            pdf.setFillColor(240, 240, 240);
            pdf.rect(margin, margin, pageWidth - 2 * margin, 35, 'F');

            // Logo placeholder (left side)
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('BOROSIL', margin + 5, margin + 10);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Renewables Ltd.', margin + 5, margin + 15);

            // Title (center)
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('PDI REPORT', pageWidth / 2, margin + 15, { align: 'center' });

            // Document Info (right side)
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            const dateStr = record.date?.seconds ? new Date(record.date.seconds * 1000).toLocaleDateString('en-GB') : '-';
            pdf.text(`Date: ${dateStr}`, pageWidth - margin - 5, margin + 10, { align: 'right' });
            pdf.text(`Doc ID: PDI-${record.id.substring(0, 8)}`, pageWidth - margin - 5, margin + 15, { align: 'right' });

            // Roller Information Section
            let yPos = margin + 45;
            pdf.setFillColor(230, 230, 230);
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Roller Information', margin + 5, yPos + 7);

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Roller Number: ${record.rollerNumber}`, margin + 5, yPos + 14);
            pdf.text(`Location: ${record.line} - ${record.position}`, margin + 5, yPos + 21);

            // Audit Questions Section
            yPos += 35;
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Inspection Details', margin + 5, yPos);

            yPos += 10;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            // Question labels mapping
            const questionLabels = {
                'runOut': 'Roller run-out (< 0.1mm)',
                'shaftRoughness': 'DU shaft roughness (<0.4 µm)',
                'shaftDiameter': 'DU shaft dia. (249.93-250.00 / 209.93-210.00)',
                'mountingPosition': 'DU shaft mounting position',
                'circlipGrooves': 'Circlip grooves (damage free)',
                'avgRa': 'Average Ra',
                'avgRz': 'Average Rz',
                'visualCondition': 'Visual condition'
            };

            const validate = (id, val) => {
                const num = parseFloat(val);
                if (id === 'runOut') return !isNaN(num) && num < 0.1 ? 'Pass' : 'Fail';
                if (id === 'shaftRoughness') return !isNaN(num) && num < 0.4 ? 'Pass' : 'Fail';
                if (id === 'shaftDiameter') {
                    if (isNaN(num)) return 'Fail';
                    const range1 = num >= 249.93 && num <= 250.00;
                    const range2 = num >= 209.93 && num <= 210.00;
                    return (range1 || range2) ? 'Pass' : 'Fail';
                }
                if (['mountingPosition', 'circlipGrooves', 'visualCondition'].includes(id)) {
                    if (val === 'Acceptable') return 'Pass';
                    if (val === 'Reject') return 'Fail';
                    if (val === 'Deviation') return 'Deviation';
                    return '-';
                }
                return '-';
            };

            if (auditData && auditData.questions) {
                // Table Headers for PDF
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
                pdf.text('Audit Question', margin + 2, yPos);
                pdf.text('Answer', margin + 85, yPos);
                pdf.text('Result', margin + 115, yPos);
                pdf.text('Remark', margin + 140, yPos);
                
                yPos += 10;
                pdf.setFontSize(8);
                
                const questionsOrder = [
                    'runOut', 'shaftRoughness', 'shaftDiameter', 'mountingPosition', 
                    'circlipGrooves', 'avgRa', 'avgRz', 'visualCondition'
                ];

                questionsOrder.forEach((key) => {
                    const label = questionLabels[key] || key;
                    const value = auditData.questions[key] || '-';
                    const remark = (auditData.remarks && auditData.remarks[key]) ? auditData.remarks[key] : '-';
                    const result = validate(key, value);

                    // Row background for alternate rows
                    // pdf.setFillColor(252, 252, 252);
                    // pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');

                    pdf.setFont('helvetica', 'normal');
                    const labelLines = pdf.splitTextToSize(label, 80);
                    pdf.text(labelLines, margin + 2, yPos);
                    
                    pdf.text(`${value}`, margin + 85, yPos);
                    
                    // Result color
                    if (result === 'Pass') pdf.setTextColor(0, 128, 0);
                    else if (result === 'Fail') pdf.setTextColor(255, 0, 0);
                    else if (result === 'Deviation') pdf.setTextColor(255, 165, 0);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(`${result}`, margin + 115, yPos);
                    pdf.setTextColor(0, 0, 0);
                    pdf.setFont('helvetica', 'normal');

                    const remarkLines = pdf.splitTextToSize(remark, 40);
                    pdf.text(remarkLines, margin + 140, yPos);

                    const rowHeight = Math.max(labelLines.length * 4, remarkLines.length * 4, 8);
                    yPos += rowHeight;

                    // Draw separator line
                    pdf.setDrawColor(230, 230, 230);
                    pdf.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
                    yPos += 2;
                });
            }

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
            pdf.text(`Page 1 of 1`, pageWidth - margin, footerY + 5, { align: 'right' });

            pdf.save(`PDI_Report_${record.rollerNumber}_${dateStr.replace(/\//g, '-')}.pdf`);
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
                <AssessmentIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4" fontWeight="bold" color="primary">
                    PDI Reports
                </Typography>
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Roller #</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>PDI Date</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Audit Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : reports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">No PDI records found.</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            reports.map((row) => (
                                <TableRow key={row.id} hover>
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
                                    <TableCell>{row.line} - {row.position}</TableCell>
                                    <TableCell>{row.date?.seconds ? format(new Date(row.date.seconds * 1000), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={row.auditStatus === 'Saved' ? 'Submitted' : 'Pending'}
                                            color={row.auditStatus === 'Saved' ? 'success' : 'warning'}
                                            size="small"
                                            variant={row.auditStatus === 'Saved' ? 'filled' : 'outlined'}
                                            sx={{ fontWeight: 'bold' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant={row.auditStatus === 'Saved' ? "outlined" : "contained"}
                                            color={row.auditStatus === 'Saved' ? "success" : "primary"}
                                            size="small"
                                            startIcon={<FactCheckIcon />}
                                            onClick={() => handleAuditClick(row)}
                                        >
                                            {row.auditStatus === 'Saved' ? "View Audit" : "Perform Audit"}
                                        </Button>
                                        {row.auditStatus === 'Saved' && (
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

            <AuditForm
                open={openAudit}
                onClose={() => { setOpenAudit(false); setSelectedAuditRecord(null); }}
                recordId={selectedAuditRecord?.id}
                rollerId={selectedAuditRecord?.rollerId}
            />
        </Container>
    );
}
