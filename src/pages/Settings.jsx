import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Grid,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useSnackbar } from 'notistack';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Default System Fields (cannot be deleted, only hidden)
// Default System Fields (cannot be deleted, only hidden)
import { DEFAULT_FIELDS } from '../constants/formFields';

export default function Settings() {
  const [value, setValue] = useState(0);
  const [dropdowns, setDropdowns] = useState({
    activityTypes: [],
    lines: [],
    designPatterns: []
  });
  const [newOption, setNewOption] = useState('');
  const [selectedDropdown, setSelectedDropdown] = useState('activityTypes');

  // Form Config State
  const [selectedActivity, setSelectedActivity] = useState('');
  const [fields, setFields] = useState([]);

  // User Management State
  const [users, setUsers] = useState([]);

  // Add Field Dialog State
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text', options: '' });

  const { enqueueSnackbar } = useSnackbar();
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchDropdowns();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedActivity) {
      fetchFormConfig(selectedActivity);
    } else {
      setFields([]);
    }
  }, [selectedActivity]);

  const fetchDropdowns = async () => {
    try {
      const docRef = doc(db, 'settings', 'dropdowns');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setDropdowns(docSnap.data());
      } else {
        const initialData = {
          activityTypes: ['Production Start', 'Production End', 'Roller Sent', 'Roller Received'],
          lines: ['SG#1', 'SG#2', 'SG#3.1', 'SG#3.2'],
          designPatterns: ['Pattern A', 'Pattern B']
        };
        await setDoc(docRef, initialData);
        setDropdowns(initialData);
      }
    } catch (error) {
      console.error("Error fetching dropdowns:", error);
      enqueueSnackbar('Error loading settings.', { variant: 'error' });
    }
  };

  const fetchFormConfig = async (activityType) => {
    try {
      const docRef = doc(db, 'formConfigs', activityType);
      const docSnap = await getDoc(docRef);

      // Filter out date and activity as they are handled separately in the UI
      const defaultSystemFields = DEFAULT_FIELDS.filter(f => f.id !== 'date' && f.id !== 'activity');

      if (docSnap.exists() && docSnap.data().fields) {
        const savedFields = docSnap.data().fields;
        const savedFieldsMap = new Map(savedFields.map(f => [f.id, f]));
        const systemFieldIds = new Set(DEFAULT_FIELDS.map(f => f.id));

        // 1. Merge System Fields (Enforce default order and latest definitions)
        const mergedFields = defaultSystemFields.map(defaultField => {
          const savedField = savedFieldsMap.get(defaultField.id);
          if (savedField) {
            // Keep saved visibility and required status, but update definition
            return {
              ...defaultField,
              visible: savedField.visible,
              required: savedField.required
            };
          }
          return defaultField; // New system field found in defaults but not in DB
        });

        // 2. Append Custom Fields (Preserve user-added fields)
        savedFields.forEach(savedField => {
          if (!systemFieldIds.has(savedField.id)) {
            mergedFields.push(savedField);
          }
        });

        setFields(mergedFields);
      } else {
        setFields(defaultSystemFields);
      }
    } catch (error) {
      console.error("Error fetching form config:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const userList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setValue(newValue);
  };

  // --- Dropdown Management ---
  const handleAddOption = async () => {
    if (!newOption.trim()) return;
    try {
      const docRef = doc(db, 'settings', 'dropdowns');
      await updateDoc(docRef, {
        [selectedDropdown]: arrayUnion(newOption.trim())
      });
      setDropdowns(prev => ({
        ...prev,
        [selectedDropdown]: [...(prev[selectedDropdown] || []), newOption.trim()]
      }));
      setNewOption('');
      enqueueSnackbar('Option added', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error adding option', { variant: 'error' });
    }
  };

  const handleDeleteOption = async (option) => {
    if (!window.confirm(`Delete "${option}"?`)) return;
    try {
      const docRef = doc(db, 'settings', 'dropdowns');
      await updateDoc(docRef, {
        [selectedDropdown]: arrayRemove(option)
      });
      setDropdowns(prev => ({
        ...prev,
        [selectedDropdown]: prev[selectedDropdown].filter(item => item !== option)
      }));
      enqueueSnackbar('Option deleted', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error deleting option', { variant: 'error' });
    }
  };

  // --- Field Management ---
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFields(items);
  };

  const handleFieldChange = (index, property, value) => {
    const updatedFields = [...fields];
    updatedFields[index][property] = value;
    setFields(updatedFields);
  };

  const handleAddField = () => {
    if (!newField.label) return;
    const id = newField.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const fieldToAdd = {
      id,
      label: newField.label,
      type: newField.type,
      required: false,
      visible: true,
      isSystem: false,
      options: newField.type === 'dropdown' ? newField.options : ''
    };
    setFields([...fields, fieldToAdd]);
    setOpenAddDialog(false);
    setNewField({ label: '', type: 'text', options: '' });
  };

  const handleDeleteField = (index) => {
    const updatedFields = [...fields];
    updatedFields.splice(index, 1);
    setFields(updatedFields);
  };

  const handleSaveConfig = async () => {
    if (!selectedActivity) return;
    try {
      await setDoc(doc(db, 'formConfigs', selectedActivity), { fields });
      enqueueSnackbar('Form configuration saved', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error saving configuration', { variant: 'error' });
    }
  };

  // --- User Management ---
  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      enqueueSnackbar('User role updated', { variant: 'success' });
    } catch (error) {
      console.error("Error updating role:", error);
      enqueueSnackbar('Error updating role', { variant: 'error' });
    }
  };

  const dropdownLabels = {
    activityTypes: 'Activity Types',
    lines: 'Production Lines',
    designPatterns: 'Design Patterns'
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
        System Settings
      </Typography>

      <Paper sx={{ width: '100%', mb: 4 }}>
        <Tabs value={value} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
          <Tab label="Dropdown Management" />
          <Tab label="Form Customization" />
          <Tab label="User Management" />
        </Tabs>

        {/* Tab 1: Dropdown Management */}
        <TabPanel value={value} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Select Dropdown</InputLabel>
                <Select
                  value={selectedDropdown}
                  label="Select Dropdown"
                  onChange={(e) => setSelectedDropdown(e.target.value)}
                >
                  <MenuItem value="activityTypes">Activity Types</MenuItem>
                  <MenuItem value="lines">Production Lines</MenuItem>
                  <MenuItem value="designPatterns">Design Patterns</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={8}>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Add new ${dropdownLabels[selectedDropdown] || 'Option'}`}
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddOption}
                  disabled={!newOption.trim()}
                >
                  Add
                </Button>
              </Box>

              <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #eee' }}>
                {(dropdowns[selectedDropdown] || []).map((option, index) => (
                  <React.Fragment key={option}>
                    <ListItem
                      secondaryAction={
                        <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteOption(option)}>
                          <DeleteIcon color="error" />
                        </IconButton>
                      }
                    >
                      <ListItemText primary={option} />
                    </ListItem>
                    {index < (dropdowns[selectedDropdown]?.length - 1) && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Form Customization */}
        <TabPanel value={value} index={1}>
          <Box mb={3} display="flex" alignItems="center" gap={2}>
            <FormControl fullWidth size="small" sx={{ maxWidth: 300 }}>
              <InputLabel>Activity Type</InputLabel>
              <Select
                value={selectedActivity}
                label="Activity Type"
                onChange={(e) => setSelectedActivity(e.target.value)}
              >
                {(dropdowns.activityTypes || []).map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedActivity && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenAddDialog(true)}
                sx={{ ml: 'auto' }}
              >
                Add Custom Field
              </Button>
            )}
          </Box>

          {selectedActivity ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell width={50}></TableCell>
                      <TableCell>Label</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Visible</TableCell>
                      <TableCell>Required</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <Droppable droppableId="fields">
                    {(provided) => (
                      <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                        {fields.map((field, index) => (
                          <Draggable key={field.id} draggableId={field.id} index={index}>
                            {(provided) => (
                              <TableRow
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 }, bgcolor: 'white' }}
                              >
                                <TableCell {...provided.dragHandleProps}>
                                  <DragIndicatorIcon color="action" sx={{ cursor: 'grab' }} />
                                </TableCell>
                                <TableCell>{field.label}</TableCell>
                                <TableCell>
                                  <Chip label={field.type} size="small" variant="outlined" />
                                  {field.type === 'dropdown' && (
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      {field.useGlobalOptions ? `Global: ${dropdownLabels[field.useGlobalOptions]}` : field.options}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Checkbox
                                    checked={field.visible}
                                    onChange={(e) => handleFieldChange(index, 'visible', e.target.checked)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Checkbox
                                    checked={field.required}
                                    onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                                    disabled={!field.visible}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  {!field.isSystem && (
                                    <IconButton onClick={() => handleDeleteField(index)} color="error" size="small">
                                      <DeleteIcon />
                                    </IconButton>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </TableBody>
                    )}
                  </Droppable>
                </Table>
              </TableContainer>
              <Box display="flex" justifyContent="flex-end" mt={3}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveConfig}
                  size="large"
                >
                  Save Configuration
                </Button>
              </Box>
            </DragDropContext>
          ) : (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              Please select an Activity Type to configure its form.
            </Typography>
          )}
        </TabPanel>

        {/* Tab 3: User Management */}
        <TabPanel value={value} index={2}>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Last Login</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar>{(user.email || 'U').charAt(0).toUpperCase()}</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{user.email}</Typography>
                          <Typography variant="caption" color="text.secondary">ID: {user.id}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth sx={{ maxWidth: 150 }}>
                        <Select
                          value={user.role || 'Viewer'}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={user.id === currentUser?.uid} // Prevent changing own role
                        >
                          <MenuItem value="Viewer">Viewer</MenuItem>
                          <MenuItem value="Editor">Editor</MenuItem>
                          <MenuItem value="Approver">Approver</MenuItem>
                          <MenuItem value="Admin">Admin</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      {/* Placeholder for last login if available, else just show status */}
                      <Chip label="Active" color="success" size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

      </Paper>

      {/* Add Field Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Add Custom Field</DialogTitle>
        <DialogContent sx={{ pt: 2, minWidth: 400 }}>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Field Label"
              fullWidth
              value={newField.label}
              onChange={(e) => setNewField({ ...newField, label: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Data Type</InputLabel>
              <Select
                value={newField.type}
                label="Data Type"
                onChange={(e) => setNewField({ ...newField, type: e.target.value })}
              >
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="decimal">Decimal</MenuItem>
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="time">Time</MenuItem>
                <MenuItem value="long_text">Long Text (TextArea)</MenuItem>
                <MenuItem value="dropdown">Dropdown</MenuItem>
              </Select>
            </FormControl>

            {newField.type === 'dropdown' && (
              <TextField
                label="Options (comma separated)"
                fullWidth
                placeholder="Option 1, Option 2, Option 3"
                value={newField.options}
                onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                helperText="Enter options separated by commas"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddField} variant="contained" disabled={!newField.label}>Add</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
