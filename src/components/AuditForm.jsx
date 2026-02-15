import React, { useState, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ErrorIcon from "@mui/icons-material/Error";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const QUESTIONS = [
  {
    id: "runOut",
    label: "Roller run-out (< 0.1mm)",
    type: "number",
    required: true,
    validate: (val) => {
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      return num < 0.1 ? "green" : "red";
    },
  },
  {
    id: "shaftRoughness",
    label: "DU shaft roughness (<0.4 µm)",
    type: "number",
    required: true,
    validate: (val) => {
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      return num < 0.4 ? "green" : "red";
    },
  },
  {
    id: "shaftDiameter",
    label: "DU shaft dia. (249.93-250.00 / 209.93-210.00)",
    type: "number",
    required: true,
    validate: (val) => {
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      const range1 = num >= 249.93 && num <= 250.0;
      const range2 = num >= 209.93 && num <= 210.0;
      return range1 || range2 ? "green" : "red";
    },
  },
  {
    id: "mountingPosition",
    label: "DU shaft mounting position",
    type: "dropdown",
    required: true,
    options: ["Acceptable", "Reject", "Deviation"],
    validate: (val) => {
      if (!val) return null;
      if (val === "Acceptable") return "green";
      if (val === "Reject") return "red";
      return "yellow";
    },
  },
  {
    id: "circlipGrooves",
    label: "Circlip grooves (damage free)",
    type: "dropdown",
    required: true,
    options: ["Acceptable", "Reject", "Deviation"],
    validate: (val) => {
      if (!val) return null;
      if (val === "Acceptable") return "green";
      if (val === "Reject") return "red";
      return "yellow";
    },
  },
  {
    id: "avgRa",
    label: "Average Ra",
    type: "number",
    required: true,
    validate: (val) => null, // Flexible for future logic
  },
  {
    id: "avgRz",
    label: "Average Rz",
    type: "number",
    required: true,
    validate: (val) => null, // Flexible for future logic
  },
  {
    id: "visualCondition",
    label: "Visual condition",
    type: "dropdown",
    required: true,
    options: ["Acceptable", "Reject", "Deviation"],
    validate: (val) => {
      if (!val) return null;
      if (val === "Acceptable") return "green";
      if (val === "Reject") return "red";
      return "yellow";
    },
  },
];

export default function AuditForm({ open, onClose, recordId, rollerId }) {
  const [answers, setAnswers] = useState({});
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();

  useEffect(() => {
    if (open && recordId) {
      setLoading(true);
      const fetchAudit = async () => {
        try {
          const docRef = doc(db, "audits", recordId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setAnswers(data.questions || {});
            setRemarks(data.remarks || {});
          } else {
            setAnswers({});
            setRemarks({});
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
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleRemarkChange = (id, value) => {
    setRemarks((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    // Validation
    const missing = QUESTIONS.filter((q) => q.required && !answers[q.id]);
    if (missing.length > 0) {
      setError(
        `Please fill in all required fields: ${missing.map((q) => q.label).join(", ")}`,
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Save Audit Data
      const auditData = {
        rollerId,
        recordId,
        questions: answers,
        remarks: remarks,
        savedAt: new Date(),
        savedBy: currentUser.uid,
      };
      await setDoc(doc(db, "audits", recordId), auditData);

      // 2. Update Record Status
      await updateDoc(doc(db, `rollers/${rollerId}/records`, recordId), {
        auditStatus: "Saved",
      });

      onClose();
    } catch (err) {
      console.error("Error saving audit:", err);
      setError("Failed to save audit data.");
    } finally {
      setLoading(false);
    }
  };

  const renderTick = (q) => {
    const color = q.validate(answers[q.id]);
    if (!color) return null;

    if (color === "green") return <CheckCircleIcon sx={{ color: "#4caf50" }} />;
    if (color === "red") return <CancelIcon sx={{ color: "#f44336" }} />;
    if (color === "yellow") return <ErrorIcon sx={{ color: "#ff9800" }} />;
    return null;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{ bgcolor: "#1976d2", color: "white", fontWeight: "bold" }}
      >
        Roller PDI Audit Form
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: "1px solid #e0e0e0", mt: 1 }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: "#f5f5f5" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold", width: "35%" }}>
                  Question
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", width: "25%" }}>
                  Answer
                </TableCell>
                <TableCell
                  sx={{ fontWeight: "bold", width: "10%", textAlign: "center" }}
                >
                  Result
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", width: "30%" }}>
                  Remark
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {QUESTIONS.map((q) => (
                <TableRow key={q.id}>
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {q.label}{" "}
                    {q.required && <span style={{ color: "red" }}>*</span>}
                  </TableCell>
                  <TableCell>
                    {q.type === "dropdown" ? (
                      <FormControl fullWidth size="small">
                        <Select
                          value={answers[q.id] || ""}
                          onChange={(e) => handleChange(q.id, e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="" disabled>
                            Select
                          </MenuItem>
                          {q.options.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={answers[q.id] || ""}
                        onChange={(e) => handleChange(q.id, e.target.value)}
                        inputProps={{ step: "0.01" }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">{renderTick(q)}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      value={remarks[q.id] || ""}
                      onChange={(e) => handleRemarkChange(q.id, e.target.value)}
                      placeholder="Add remark..."
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: "#f5f5f5" }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Audit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
