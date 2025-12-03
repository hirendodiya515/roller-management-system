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
                'runOut': 'Roller Run-out (mm)',
                'shaftRoughness': 'DU Shaft Roughness (μm)',
                'shaftDiameter': 'DU Shaft Diameter (mm)',
                'mountingPosition': 'DU Shaft Mounting Position',
                'placeholder1': 'Additional Check 1',
                'placeholder2': 'Additional Check 2'
            };

            if (auditData && auditData.questions) {
                Object.entries(auditData.questions).forEach(([key, value]) => {
                    const label = questionLabels[key] || key;

                    // Draw question background
                    pdf.setFillColor(250, 250, 250);
                    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 12, 'F');

                    // Question label
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(`${label}:`, margin + 5, yPos);

                    // Answer
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(`${value || 'N/A'}`, margin + 80, yPos);

                    yPos += 14;
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
