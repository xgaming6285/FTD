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
    switch (leadType) {
      case "ftd":
        return "primary";
      case "filler":
        return "secondary";
      case "cold":
        return "info";
      default:
        return "default";
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "affiliate_manager";
  const canAssignLeads = isAdmin;
  const numSelected = selectedLeads.size;

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" gutterBottom>
          {user?.role === "agent" ? "My Assigned Leads" : "Lead Management"}
        </Typography>
        {canAssignLeads && numSelected > 0 && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setAssignDialogOpen(true)}
          >
            Assign {numSelected} Lead{numSelected !== 1 ? "s" : ""}
          </Button>
        )}
      </Box>

      {/* Success/Error Messages */}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Lead Statistics for Admins */}
      {isAdmin && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Lead Assignment Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {totalLeads}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Total Leads
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {leads.filter((lead) => lead.isAssigned).length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Assigned
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {leads.filter((lead) => !lead.isAssigned).length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Unassigned
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">
                    {Math.round(
                      (leads.filter((lead) => lead.isAssigned).length /
                        (leads.length || 1)) *
                        100
                    )}
                    %
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Assignment Rate
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Filters & Search</Typography>
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showFilters}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
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
          </Collapse>
        </CardContent>
      </Card>

      {/* Leads Table */}
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 10 : 9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 10 : 9} align="center">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <React.Fragment key={lead._id}>
                    <TableRow>
                      {canAssignLeads && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedLeads.has(lead._id)}
                            onChange={handleSelectLead(lead._id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {lead.fullName ||
                              `${lead.firstName} ${lead.lastName || ""}`.trim()}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {lead._id.slice(-8)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lead.leadType.toUpperCase()}
                          color={getLeadTypeColor(lead.leadType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{lead.email}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {lead.phone}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{lead.country}</TableCell>
                      <TableCell>
                        <Box>
                          {lead.client && (
                            <Typography variant="caption" display="block">
                              <strong>Client:</strong> {lead.client}
                            </Typography>
                          )}
                          {lead.clientBroker && (
                            <Typography variant="caption" display="block">
                              <strong>Broker:</strong> {lead.clientBroker}
                            </Typography>
                          )}
                          {lead.clientNetwork && (
                            <Typography variant="caption" display="block">
                              <strong>Network:</strong> {lead.clientNetwork}
                            </Typography>
                          )}
                          {!lead.client && !lead.clientBroker && !lead.clientNetwork && (
                            <Typography variant="caption" color="textSecondary">
                              N/A
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {lead.isAssigned ? (
                            <Box display="flex" alignItems="center">
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  mr: 1,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {lead.assignedTo?.fourDigitCode ||
                                  lead.assignedTo?.fullName?.[0] ||
                                  "A"}
                              </Avatar>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: "medium" }}
                                >
                                  {lead.assignedTo?.fullName || "Unknown Agent"}
                                </Typography>
                                {lead.assignedTo?.fourDigitCode && (
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    display="block"
                                  >
                                    #{lead.assignedTo.fourDigitCode}
                                  </Typography>
                                )}
                                {lead.assignedAt && (
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    display="block"
                                  >
                                    {new Date(
                                      lead.assignedAt
                                    ).toLocaleDateString()}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          ) : (
                            <Chip
                              label="Unassigned"
                              size="small"
                              variant="outlined"
                              color="warning"
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={lead.status}
                            onChange={(e) =>
                              updateLeadStatus(lead._id, e.target.value)
                            }
                          >
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="contacted">Contacted</MenuItem>
                            <MenuItem value="converted">Converted</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedLead(lead);
                            setCommentDialogOpen(true);
                          }}
                          title="Add Comment"
                        >
                          <CommentIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(lead._id)}
                          title="View Details"
                        >
                          {expandedRows.has(lead._id) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(lead._id) && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 10 : 9}>
                          <Box sx={{ p: 2, bgcolor: "grey.50" }}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Contact Details
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Email:</strong> {lead.email || "N/A"}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Phone:</strong> {lead.phone || "N/A"}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Country:</strong>{" "}
                                  {lead.country || "N/A"}
                                </Typography>

                                {/* Client Information */}
                                {(lead.client || lead.clientBroker || lead.clientNetwork) && (
                                  <Box sx={{ mt: 2 }}>
                                    <Typography
                                      variant="subtitle2"
                                      gutterBottom
                                    >
                                      Client Information
                                    </Typography>
                                    {lead.client && (
                                      <Typography variant="body2">
                                        <strong>Client:</strong> {lead.client}
                                      </Typography>
                                    )}
                                    {lead.clientBroker && (
                                      <Typography variant="body2">
                                        <strong>Client Broker:</strong> {lead.clientBroker}
                                      </Typography>
                                    )}
                                    {lead.clientNetwork && (
                                      <Typography variant="body2">
                                        <strong>Client Network:</strong> {lead.clientNetwork}
                                      </Typography>
                                    )}
                                  </Box>
                                )}

                                {lead.leadType === "ftd" && lead.documents && (
                                  <Box sx={{ mt: 2 }}>
                                    <Typography
                                      variant="subtitle2"
                                      gutterBottom
                                    >
                                      Documents Status
                                    </Typography>
                                    <Chip
                                      label={lead.documents.status}
                                      color={
                                        lead.documents.status === "good"
                                          ? "success"
                                          : lead.documents.status === "ok"
                                          ? "warning"
                                          : "default"
                                      }
                                      size="small"
                                    />
                                  </Box>
                                )}
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Comments ({lead.comments?.length || 0})
                                </Typography>
                                <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
                                  {lead.comments && lead.comments.length > 0 ? (
                                    lead.comments.map((comment, index) => (
                                      <Box key={index} sx={{ mb: 2 }}>
                                        <Typography
                                          variant="caption"
                                          color="textSecondary"
                                        >
                                          {comment.author?.fullName} -{" "}
                                          {new Date(
                                            comment.createdAt
                                          ).toLocaleString()}
                                        </Typography>
                                        <Typography
                                          variant="body2"
                                          sx={{ mt: 0.5 }}
                                        >
                                          {comment.text}
                                        </Typography>
                                        {index < lead.comments.length - 1 && (
                                          <Divider sx={{ mt: 1 }} />
                                        )}
                                      </Box>
                                    ))
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="textSecondary"
                                    >
                                      No comments yet
                                    </Typography>
                                  )}
                                </Box>
                              </Grid>
                            </Grid>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
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
