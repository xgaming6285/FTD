import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Checkbox,
  Stack,
  Avatar,
  Divider,
  FormControlLabel,
  Switch,
  Link,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  Comment as CommentIcon,
  Assignment as AssignmentIcon,
  PersonAdd as PersonAddIcon,
  FilterList as FilterIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import { motion, AnimatePresence } from "framer-motion";
import { alpha } from "@mui/material/styles";

// Validation schema for comments
const commentSchema = yup.object({
  text: yup
    .string()
    .required("Comment is required")
    .min(3, "Comment must be at least 3 characters"),
});

// Validation schema for assignment
const assignmentSchema = yup.object({
  agentId: yup.string().required("Agent is required"),
});

// Animation variants
const pageTransition = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3
    }
  }
};

const listItemVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.3
    }
  }
};

const cardStyle = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.25)',
  },
};

const tableRowStyle = {
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    transform: 'scale(1.002)',
    transition: 'all 0.2s ease',
  },
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const mobileCardStyle = {
  p: 2,
  mb: 2,
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.25)',
  },
};

const LeadsPage = () => {
  const user = useSelector(selectUser);

  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dialog states
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState(new Set());

  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalLeads, setTotalLeads] = useState(0);
  const [filters, setFilters] = useState({
    leadType: "",
    isAssigned: "",
    country: "",
    status: "",
    documentStatus: "",
    search: "",
    includeConverted: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const {
    control: commentControl,
    handleSubmit: handleCommentSubmit,
    reset: resetComment,
    formState: { errors: commentErrors, isSubmitting: isCommentSubmitting },
  } = useForm({
    resolver: yupResolver(commentSchema),
    defaultValues: { text: "" },
  });

  const {
    control: assignControl,
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
    formState: { errors: assignErrors, isSubmitting: isAssignSubmitting },
  } = useForm({
    resolver: yupResolver(assignmentSchema),
    defaultValues: { agentId: "" },
  });

  // Log user state when component mounts
  useEffect(() => {
    console.log("Current user state:", user);
  }, [user]);

  // Fetch leads
  const fetchLeads = async () => {
    setLoading(true);
    setError(null);

    try {
      // For system administrators, don't include empty isAssigned filter to show all leads
      const paramsObject = {
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      };

      // For admins, if isAssigned filter is empty, remove it to show all leads
      if (
        (user?.role === "admin" || user?.role === "affiliate_manager") &&
        !paramsObject.isAssigned
      ) {
        delete paramsObject.isAssigned;
      }

      const params = new URLSearchParams(paramsObject);

      // Use appropriate endpoint based on user role
      const endpoint = user?.role === "agent" ? "/leads/assigned" : "/leads";
      console.log("Fetching leads - User role:", user?.role);
      console.log("Using endpoint:", endpoint);
      console.log("Request params:", Object.fromEntries(params));

      const response = await api.get(`${endpoint}?${params}`);
      console.log("API Response:", response.data);

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to fetch leads");
      }

      setLeads(response.data.data);
      setTotalLeads(response.data.pagination.totalLeads);
    } catch (err) {
      console.error("Error fetching leads:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to fetch leads";
      console.error("Error details:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch agents for assignment
  const fetchAgents = async () => {
    try {
      const response = await api.get("/users?role=agent&isActive=true");
      setAgents(response.data.data);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  };

  useEffect(() => {
    fetchLeads();
    if (user?.role === "admin" || user?.role === "affiliate_manager") {
      fetchAgents();
    }
  }, [page, rowsPerPage, filters, user]);

  // Add comment
  const onSubmitComment = async (data) => {
    try {
      setError(null);
      await api.put(`/leads/${selectedLead._id}/comment`, data);
      setSuccess("Comment added successfully!");
      setCommentDialogOpen(false);
      resetComment();
      fetchLeads();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment");
    }
  };

  // Assign leads
  const onSubmitAssignment = async (data) => {
    try {
      setError(null);
      const leadIds = Array.from(selectedLeads);
      await api.post("/leads/assign", {
        leadIds,
        agentId: data.agentId,
      });
      setSuccess(`${leadIds.length} lead(s) assigned successfully!`);
      setAssignDialogOpen(false);
      resetAssign();
      setSelectedLeads(new Set());
      fetchLeads();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign leads");
    }
  };

  // Update lead status
  const updateLeadStatus = async (leadId, status) => {
    try {
      setError(null);
      await api.put(`/leads/${leadId}/status`, { status });
      setSuccess("Lead status updated successfully!");
      fetchLeads();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update lead status");
    }
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter handlers
  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      leadType: "",
      isAssigned: "",
      country: "",
      status: "",
      documentStatus: "",
      search: "",
      includeConverted: true,
    });
    setPage(0);
  };

  // Selection handlers
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = new Set(leads.map((lead) => lead._id));
      setSelectedLeads(newSelected);
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId) => (event) => {
    const newSelected = new Set(selectedLeads);
    if (event.target.checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  // Toggle row expansion
  const toggleRowExpansion = (leadId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(leadId)) {
      newExpanded.delete(leadId);
    } else {
      newExpanded.add(leadId);
    }
    setExpandedRows(newExpanded);
  };

  // Status color mapping
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "contacted":
        return "info";
      case "converted":
        return "success";
      case "inactive":
        return "error";
      default:
        return "default";
    }
  };

  // Lead type color mapping
  const getLeadTypeColor = (leadType) => {
    if (!leadType) return 'default';
    switch (leadType.toLowerCase()) {
      case "ftd":
        return "success";
      case "filler":
        return "warning";
      case "cold":
        return "info";
      default:
        return "default";
    }
  };

  // Update the Chip component styling to handle undefined color values safely
  const getChipGradient = (theme, colorName) => {
    const color = theme.palette[colorName] || theme.palette.grey;
    return `linear-gradient(45deg, ${color.light || color.main}, ${color.main})`;
  };

  const isAdmin = user?.role === "admin" || user?.role === "affiliate_manager";
  const canAssignLeads = isAdmin;
  const numSelected = selectedLeads.size;

  return (
    <Box component={motion.div} 
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" gutterBottom sx={{
          background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          {user?.role === "agent" ? "My Assigned Leads" : "Lead Management"}
        </Typography>
        {canAssignLeads && numSelected > 0 && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setAssignDialogOpen(true)}
            sx={{
              background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: '0 4px 12px 0 rgba(31, 38, 135, 0.15)',
              '&:hover': {
                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                boxShadow: '0 6px 16px 0 rgba(31, 38, 135, 0.25)',
              }
            }}
          >
            Assign {numSelected} Lead{numSelected !== 1 ? "s" : ""}
          </Button>
        )}
      </Box>

      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead Statistics for Admins */}
      {isAdmin && (
        <Card sx={{ ...cardStyle, mb: 2 }}>
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: 'primary.main', 
                fontWeight: 'bold', 
                display: 'flex', 
                alignItems: 'center',
                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                <AssignmentIcon sx={{ mr: 1 }} />
                Lead Assignment Summary
              </Typography>
              <Divider />
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.8)',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.02)'
                  }
                }}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="h4" sx={{
                      fontWeight: 'bold',
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {totalLeads}
                    </Typography>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px',
                      mt: 1
                    }}>
                      Total Leads
                    </Typography>
                  </Box>
                  <Chip 
                    label="All Time" 
                    size="small" 
                    sx={{ 
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                      color: 'white',
                      fontWeight: 'bold'
                    }} 
                  />
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.8)',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.02)'
                  }
                }}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="h4" sx={{
                      fontWeight: 'bold',
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {leads.filter((lead) => lead.isAssigned).length}
                    </Typography>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px',
                      mt: 1
                    }}>
                      Assigned
                    </Typography>
                  </Box>
                  <Chip 
                    label="Active" 
                    size="small" 
                    sx={{ 
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.success.light}, ${theme.palette.success.main})`,
                      color: 'white',
                      fontWeight: 'bold'
                    }} 
                  />
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.8)',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.02)'
                  }
                }}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="h4" sx={{
                      fontWeight: 'bold',
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {leads.filter((lead) => !lead.isAssigned).length}
                    </Typography>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px',
                      mt: 1
                    }}>
                      Unassigned
                    </Typography>
                  </Box>
                  <Chip 
                    label="Pending" 
                    size="small" 
                    sx={{ 
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.warning.light}, ${theme.palette.warning.main})`,
                      color: 'white',
                      fontWeight: 'bold'
                    }} 
                  />
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.8)',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.02)'
                  }
                }}>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="h4" sx={{
                      fontWeight: 'bold',
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {Math.round(
                        (leads.filter((lead) => lead.isAssigned).length /
                          (leads.length || 1)) *
                          100
                      )}%
                    </Typography>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px',
                      mt: 1
                    }}>
                      Assignment Rate
                    </Typography>
                  </Box>
                  <Chip 
                    label="Progress" 
                    size="small" 
                    sx={{ 
                      background: (theme) => `linear-gradient(45deg, ${theme.palette.info.light}, ${theme.palette.info.main})`,
                      color: 'white',
                      fontWeight: 'bold'
                    }} 
                  />
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Filters Card */}
      <Card sx={{ ...cardStyle, mb: 2 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" sx={{
              background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center'
            }}>
              <FilterIcon sx={{ mr: 1 }} />
              Filters & Search
            </Typography>
            <IconButton 
              onClick={() => setShowFilters(!showFilters)}
              sx={{
                transition: 'transform 0.3s ease',
                transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
          
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="Search"
                      value={filters.search}
                      onChange={handleFilterChange("search")}
                      placeholder="Name, email, phone..."
                      InputProps={{
                        startAdornment: (
                          <SearchIcon sx={{ mr: 1, color: "action.active" }} />
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Lead Type</InputLabel>
                      <Select
                        value={filters.leadType}
                        label="Lead Type"
                        onChange={handleFilterChange("leadType")}
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="ftd">FTD</MenuItem>
                        <MenuItem value="filler">Filler</MenuItem>
                        <MenuItem value="cold">Cold</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {isAdmin && (
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth>
                        <InputLabel>Assignment</InputLabel>
                        <Select
                          value={filters.isAssigned}
                          label="Assignment"
                          onChange={handleFilterChange("isAssigned")}
                        >
                          <MenuItem value="">All</MenuItem>
                          <MenuItem value="true">Assigned</MenuItem>
                          <MenuItem value="false">Unassigned</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filters.status}
                        label="Status"
                        onChange={handleFilterChange("status")}
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="contacted">Contacted</MenuItem>
                        <MenuItem value="converted">Converted</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {isAdmin && (
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={filters.includeConverted}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                includeConverted: e.target.checked,
                              }))
                            }
                            color="primary"
                          />
                        }
                        label="Show Converted"
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      fullWidth
                      label="Country"
                      value={filters.country}
                      onChange={handleFilterChange("country")}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button onClick={clearFilters} variant="outlined">
                      Clear Filters
                    </Button>
                  </Grid>
                </Grid>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Leads Table with Animation */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
          >
            <CircularProgress />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Paper>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        {canAssignLeads && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              indeterminate={
                                numSelected > 0 && numSelected < leads.length
                              }
                              checked={leads.length > 0 && numSelected === leads.length}
                              onChange={handleSelectAll}
                            />
                          </TableCell>
                        )}
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Contact</TableCell>
                        <TableCell>Country</TableCell>
                        <TableCell>Client Info</TableCell>
                        {isAdmin && <TableCell>Assigned To</TableCell>}
                        <TableCell>Status</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leads.map((lead) => (
                        <React.Fragment key={lead._id}>
                          <TableRow 
                            hover
                            sx={{
                              ...tableRowStyle,
                              borderLeft: (theme) => {
                                const color = getLeadTypeColor(lead.leadType);
                                return `4px solid ${theme.palette[color]?.main || theme.palette.grey.main}`;
                              }
                            }}
                          >
                            {canAssignLeads && (
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedLeads.has(lead._id)}
                                  onChange={handleSelectLead(lead._id)}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar 
                                  sx={{ 
                                    bgcolor: (theme) => {
                                      const color = getLeadTypeColor(lead.leadType);
                                      return theme.palette[color]?.light || theme.palette.grey.light;
                                    },
                                    color: (theme) => {
                                      const color = getLeadTypeColor(lead.leadType);
                                      return theme.palette[color]?.main || theme.palette.grey.main;
                                    }
                                  }}
                                >
                                  {(lead.fullName || `${lead.firstName} ${lead.lastName || ""}`.trim()).charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">
                                    {lead.fullName ||
                                      `${lead.firstName} ${lead.lastName || ""}`.trim()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    ID: {lead._id.slice(-8)}
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={lead.leadType?.toUpperCase() || 'N/A'}
                                size="small"
                                sx={{
                                  background: (theme) => getChipGradient(theme, getLeadTypeColor(lead.leadType)),
                                  color: 'white',
                                  fontWeight: 'bold',
                                  mb: 1
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span style={{ color: 'text.secondary' }}>📧</span> {lead.email}
                                </Typography>
                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span style={{ color: 'text.secondary' }}>📱</span> {lead.phone || 'N/A'}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={lead.country || 'Unknown'}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  borderRadius: 1,
                                  backgroundColor: 'background.paper',
                                  '& .MuiChip-label': { px: 1 }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="subtitle2" color="primary" gutterBottom>
                                  Client Info
                                </Typography>
                                {lead.client && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>Client:</Typography>
                                    <Typography variant="body2">{lead.client}</Typography>
                                  </Box>
                                )}
                                {lead.clientBroker && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>Broker:</Typography>
                                    <Typography variant="body2">{lead.clientBroker}</Typography>
                                  </Box>
                                )}
                                {lead.clientNetwork && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>Network:</Typography>
                                    <Typography variant="body2">{lead.clientNetwork}</Typography>
                                  </Box>
                                )}
                                {!lead.client && !lead.clientBroker && !lead.clientNetwork && (
                                  <Typography variant="caption" color="text.secondary">
                                    No client info available
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                {lead.assignedTo ? (
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar
                                      sx={{
                                        width: 24,
                                        height: 24,
                                        fontSize: '0.75rem',
                                        bgcolor: 'primary.main'
                                      }}
                                    >
                                      {lead.assignedTo.fullName.charAt(0)}
                                    </Avatar>
                                    <Typography variant="body2">
                                      {lead.assignedTo.fullName}
                                    </Typography>
                                  </Stack>
                                ) : (
                                  <Chip
                                    label="Unassigned"
                                    size="small"
                                    color="default"
                                    variant="outlined"
                                  />
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Chip
                                label={lead.status?.toUpperCase() || 'N/A'}
                                size="small"
                                sx={{
                                  mt: 1,
                                  background: (theme) => getChipGradient(theme, getStatusColor(lead.status)),
                                  color: 'white',
                                  fontWeight: 'bold'
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(lead.createdAt).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                  <Select
                                    value={lead.status}
                                    onChange={(e) => updateLeadStatus(lead._id, e.target.value)}
                                    size="small"
                                  >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="contacted">Contacted</MenuItem>
                                    <MenuItem value="converted">Converted</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                  </Select>
                                </FormControl>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedLead(lead);
                                    setCommentDialogOpen(true);
                                  }}
                                >
                                  <CommentIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => toggleRowExpansion(lead._id)}
                                >
                                  {expandedRows.has(lead._id) ? (
                                    <ExpandLessIcon />
                                  ) : (
                                    <ExpandMoreIcon />
                                  )}
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                          {expandedRows.has(lead._id) && (
                            <TableRow>
                              <TableCell 
                                colSpan={isAdmin ? 10 : 9}
                                sx={{ 
                                  bgcolor: 'background.default',
                                  borderBottom: '2px solid',
                                  borderBottomColor: 'divider',
                                  py: 3
                                }}
                              >
                                <Box sx={{ px: 2 }}>
                                  <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                      <Paper 
                                        elevation={0} 
                                        sx={{ 
                                          p: 2, 
                                          bgcolor: 'background.paper',
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider'
                                        }}
                                      >
                                        <Typography 
                                          variant="subtitle2" 
                                          gutterBottom
                                          sx={{ 
                                            color: 'primary.main',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            mb: 2
                                          }}
                                        >
                                          <PersonAddIcon fontSize="small" />
                                          Contact Details
                                        </Typography>
                                        <Stack spacing={2}>
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                              Email Address
                                            </Typography>
                                            <Typography variant="body2" fontWeight="medium">
                                              {lead.email || "N/A"}
                                            </Typography>
                                          </Box>
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                              Phone Number
                                            </Typography>
                                            <Typography variant="body2" fontWeight="medium">
                                              {lead.phone || "N/A"}
                                            </Typography>
                                          </Box>
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                              Location
                                            </Typography>
                                            <Typography variant="body2" fontWeight="medium">
                                              {lead.country || "N/A"}
                                            </Typography>
                                          </Box>
                                          <Box>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                              Social Media
                                            </Typography>
                                            <Stack spacing={1}>
                                              {lead.socialMedia?.facebook && (
                                                <Link href={lead.socialMedia.facebook} target="_blank" rel="noopener noreferrer" 
                                                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}>
                                                  <img src="/facebook-icon.svg" alt="Facebook" width={16} height={16} />
                                                  Facebook
                                                </Link>
                                              )}
                                              {lead.socialMedia?.twitter && (
                                                <Link href={lead.socialMedia.twitter} target="_blank" rel="noopener noreferrer"
                                                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}>
                                                  <img src="/twitter-icon.svg" alt="Twitter" width={16} height={16} />
                                                  Twitter
                                                </Link>
                                              )}
                                              {lead.socialMedia?.linkedin && (
                                                <Link href={lead.socialMedia.linkedin} target="_blank" rel="noopener noreferrer"
                                                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}>
                                                  <img src="/linkedin-icon.svg" alt="LinkedIn" width={16} height={16} />
                                                  LinkedIn
                                                </Link>
                                              )}
                                              {lead.socialMedia?.instagram && (
                                                <Link href={lead.socialMedia.instagram} target="_blank" rel="noopener noreferrer"
                                                  sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none' }}>
                                                  <img src="/instagram-icon.svg" alt="Instagram" width={16} height={16} />
                                                  Instagram
                                                </Link>
                                              )}
                                              {lead.socialMedia?.telegram && (
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                  <img src="/telegram-icon.svg" alt="Telegram" width={16} height={16} />
                                                  {lead.socialMedia.telegram}
                                                </Typography>
                                              )}
                                              {lead.socialMedia?.whatsapp && (
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                  <img src="/whatsapp-icon.svg" alt="WhatsApp" width={16} height={16} />
                                                  {lead.socialMedia.whatsapp}
                                                </Typography>
                                              )}
                                              {!lead.socialMedia || Object.values(lead.socialMedia).every(v => !v) && (
                                                <Typography variant="body2" color="text.secondary">
                                                  No social media profiles available
                                                </Typography>
                                              )}
                                            </Stack>
                                          </Box>
                                        </Stack>
                                      </Paper>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                      <Paper 
                                        elevation={0}
                                        sx={{ 
                                          p: 2, 
                                          bgcolor: 'background.paper',
                                          borderRadius: 1,
                                          border: '1px solid',
                                          borderColor: 'divider'
                                        }}
                                      >
                                        <Typography 
                                          variant="subtitle2" 
                                          gutterBottom
                                          sx={{ 
                                            color: 'primary.main',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            mb: 2
                                          }}
                                        >
                                          <CommentIcon fontSize="small" />
                                          Comments & Activity
                                        </Typography>
                                        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                          {lead.comments && lead.comments.length > 0 ? (
                                            <Stack spacing={2}>
                                              {lead.comments.map((comment, index) => (
                                                <Box
                                                  key={index}
                                                  sx={{
                                                    p: 1.5,
                                                    bgcolor: 'action.hover',
                                                    borderRadius: 1,
                                                    position: 'relative'
                                                  }}
                                                >
                                                  <Typography 
                                                    variant="caption" 
                                                    color="text.secondary"
                                                    sx={{ mb: 0.5, display: 'block' }}
                                                  >
                                                    {comment.author.fullName} • {new Date(comment.createdAt).toLocaleString()}
                                                  </Typography>
                                                  <Typography variant="body2">
                                                    {comment.text}
                                                  </Typography>
                                                </Box>
                                              ))}
                                            </Stack>
                                          ) : (
                                            <Box 
                                              sx={{ 
                                                textAlign: 'center',
                                                py: 3,
                                                color: 'text.secondary'
                                              }}
                                            >
                                              <CommentIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                                              <Typography variant="body2">
                                                No comments yet
                                              </Typography>
                                            </Box>
                                          )}
                                        </Box>
                                      </Paper>
                                    </Grid>
                                  </Grid>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={totalLeads}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </Paper>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile/Tablet View */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
            >
              <CircularProgress />
            </motion.div>
          ) : leads.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Paper sx={{ p: 3, textAlign: 'center', ...cardStyle }}>
                <Typography color="text.secondary">No leads found</Typography>
              </Paper>
            </motion.div>
          ) : (
            <Stack spacing={2}>
              {leads.map((lead, index) => (
                <motion.div
                  key={lead._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Paper 
                    sx={{
                      ...mobileCardStyle,
                      borderLeft: (theme) => {
                        const color = getLeadTypeColor(lead.leadType);
                        return `4px solid ${theme.palette[color]?.main || theme.palette.grey.main}`;
                      },
                    }}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {`${lead.firstName} ${lead.lastName}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {lead.email}
                            </Typography>
                          </Box>
                          <Box>
                            <Chip
                              label={lead.leadType?.toUpperCase() || 'N/A'}
                              size="small"
                              sx={{
                                background: (theme) => getChipGradient(theme, getLeadTypeColor(lead.leadType)),
                                color: 'white',
                                fontWeight: 'bold',
                                mb: 1
                              }}
                            />
                            <Typography variant="caption" display="block" textAlign="right">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Chip
                          label={lead.status?.toUpperCase() || 'N/A'}
                          size="small"
                          sx={{
                            mt: 1,
                            background: (theme) => getChipGradient(theme, getStatusColor(lead.status)),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Country
                        </Typography>
                        <Typography variant="body1">
                          {lead.country || 'N/A'}
                        </Typography>
                      </Grid>

                      {isAdmin && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Assigned To
                          </Typography>
                          <Box display="flex" alignItems="center" mt={1}>
                            <Avatar
                              sx={{
                                width: 24,
                                height: 24,
                                mr: 1,
                                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                              }}
                            >
                              {lead.assignedTo?.firstName?.charAt(0) || 'N/A'}
                            </Avatar>
                            <Typography variant="body1">
                              {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned'}
                            </Typography>
                          </Box>
                        </Grid>
                      )}

                      <Grid item xs={12}>
                        <Box display="flex" justifyContent="flex-end" gap={1}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedLead(lead);
                              setCommentDialogOpen(true);
                            }}
                            sx={{
                              '&:hover': {
                                background: (theme) => alpha(theme.palette.primary.main, 0.1)
                              }
                            }}
                          >
                            <CommentIcon fontSize="small" />
                          </IconButton>
                          {canAssignLeads && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedLead(lead);
                                setAssignDialogOpen(true);
                              }}
                              sx={{
                                '&:hover': {
                                  background: (theme) => alpha(theme.palette.primary.main, 0.1)
                                }
                              }}
                            >
                              <PersonAddIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </motion.div>
              ))}
            </Stack>
          )}
        </AnimatePresence>
        
        <Box sx={{ mt: 2 }}>
          <TablePagination
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            rowsPerPageOptions={[5, 10, 25]}
            count={totalLeads}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Box>
      </Box>

      {/* Comment Dialog */}
      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <form onSubmit={handleCommentSubmit(onSubmitComment)}>
          <DialogContent>
            {selectedLead && (
              <Box mb={2}>
                <Typography variant="subtitle2">
                  Lead: {selectedLead.firstName} {selectedLead.lastName}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {selectedLead.email} • {selectedLead.leadType.toUpperCase()}
                </Typography>
              </Box>
            )}
            <Controller
              name="text"
              control={commentControl}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Comment"
                  multiline
                  rows={4}
                  error={!!commentErrors.text}
                  helperText={commentErrors.text?.message}
                  placeholder="Add your comment about this lead..."
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isCommentSubmitting}
            >
              {isCommentSubmitting ? (
                <CircularProgress size={24} />
              ) : (
                "Add Comment"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Leads to Agent</DialogTitle>
        <form onSubmit={handleAssignSubmit(onSubmitAssignment)}>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Assigning {numSelected} lead{numSelected !== 1 ? "s" : ""} to an
              agent:
            </Typography>
            <Controller
              name="agentId"
              control={assignControl}
              render={({ field }) => (
                <FormControl fullWidth error={!!assignErrors.agentId}>
                  <InputLabel>Select Agent</InputLabel>
                  <Select {...field} label="Select Agent">
                    {agents.map((agent) => (
                      <MenuItem key={agent._id} value={agent._id}>
                        <Box display="flex" alignItems="center">
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              mr: 1,
                              fontSize: "0.75rem",
                            }}
                          >
                            {agent.fourDigitCode || agent.fullName[0]}
                          </Avatar>
                          {agent.fullName} ({agent.fourDigitCode})
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {assignErrors.agentId && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5 }}
                    >
                      {assignErrors.agentId.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isAssignSubmitting}
            >
              {isAssignSubmitting ? (
                <CircularProgress size={24} />
              ) : (
                "Assign Leads"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default LeadsPage;
