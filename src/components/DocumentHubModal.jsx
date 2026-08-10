import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, InputAdornment, Button, IconButton, List,
  Tooltip, Snackbar, Paper
} from '@mui/material';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FolderIcon from '@mui/icons-material/Folder';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

// 7 Hardcoded Documents in public/docs
const SYSTEM_DOCUMENTS = [
  {
    id: 'doc-1',
    title: 'Roller management SOP',
    code: 'ROM/L3/011',
    url: '/docs/SOP Roller Management.pdf'
  },
  {
    id: 'doc-2',
    title: 'Inspection plan',
    code: 'ROM/L4/009',
    url: '/docs/INSPECTION PLAN.pdf'
  },
  {
    id: 'doc-3',
    title: 'Job card',
    code: 'ROM/L4/004',
    url: '/docs/Job card.pdf'
  },
  {
    id: 'doc-4',
    title: 'Non-Confirmity Report',
    code: 'ROM/L4/007',
    url: '/docs/Non-Conformity Report.pdf'
  },
  {
    id: 'doc-5',
    title: 'Deviation Form',
    code: 'ROM/L4/008',
    url: '/docs/Deviation Approval.pdf'
  },
  {
    id: 'doc-6',
    title: 'Post-Engraving Inspection Checksheet',
    code: 'ROM/L4/006',
    url: '/docs/Post Engraving Inspection.pdf'
  },
  {
    id: 'doc-7',
    title: 'PDI Inspection Checksheet',
    code: 'ROM/L4/005',
    url: '/docs/PDI Checklist.pdf'
  },
  {
    id: 'doc-8',
    title: 'Flow chart',
    code: 'Annexure 1',
    url: '/docs/Flow chart.pdf'
  }
];

export default function DocumentHubModal({ open, onClose, onViewDoc }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Search Filter logic
  const filteredDocuments = useMemo(() => {
    return SYSTEM_DOCUMENTS.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [searchQuery]);

  // Copy document link
  const handleCopyLink = (doc) => {
    const fullUrl = window.location.origin + doc.url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(doc.id);
    setToastMessage(`Copied link for "${doc.title}"`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '85vh',
            overflow: 'hidden'
          }
        }}
      >
        {/* Modal Header */}
        <DialogTitle
          sx={{
            p: 2.5,
            bgcolor: '#1976d2',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <FolderIcon sx={{ fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold">
              System Documents ({SYSTEM_DOCUMENTS.length})
            </Typography>
          </Box>

          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Search Input Bar */}
        <Box sx={{ p: 2, pb: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by title or document number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              sx: { borderRadius: '8px', bgcolor: 'white' }
            }}
          />
        </Box>

        {/* Document Compact List */}
        <DialogContent sx={{ p: 2, bgcolor: '#f8fafc' }}>
          {filteredDocuments.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                No matching documents found.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredDocuments.map((doc) => (
                <Paper
                  key={doc.id}
                  elevation={0}
                  sx={{
                    p: 1.8,
                    px: 2.5,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    bgcolor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#cbd5e1',
                      bgcolor: '#f8fafc',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }
                  }}
                >
                  {/* Left: File Icon + Title & Document Number Only */}
                  <Box display="flex" alignItems="center" gap={2} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        bgcolor: '#ffebee',
                        color: '#d32f2f',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <PictureAsPdfIcon fontSize="small" />
                    </Box>

                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#0f172a', lineHeight: 1.2 }} noWrap>
                        {doc.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Document Code: <b>{doc.code}</b>
                      </Typography>
                    </Box>
                  </Box>

                  {/* Right: Actions */}
                  <Box display="flex" alignItems="center" gap={1} flexShrink={0}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => onViewDoc(doc)}
                      sx={{
                        borderRadius: '6px',
                        textTransform: 'none',
                        fontWeight: 'bold',
                        py: 0.5,
                        px: 1.8
                      }}
                    >
                      View
                    </Button>

                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        component="a"
                        href={doc.url}
                        download
                        sx={{ color: '#475569', '&:hover': { bgcolor: '#f1f5f9' } }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Copy Link">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyLink(doc)}
                        sx={{ color: '#475569', '&:hover': { bgcolor: '#f1f5f9' } }}
                      >
                        {copiedId === doc.id ? <CheckIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, px: 3, bgcolor: 'white', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" fontWeight="500">
            Total {SYSTEM_DOCUMENTS.length} hardcoded system documents
          </Typography>
          <Button onClick={onClose} variant="contained" sx={{ borderRadius: '6px', px: 3, textTransform: 'none', fontWeight: 'bold' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Toast */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={2500}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
