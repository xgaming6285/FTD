import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { selectUser } from '../store/slices/authSlice';
import { getSortedCountries } from '../constants/countries';
import AssignClientInfoDialog from '../components/AssignClientInfoDialog';
import LeadDetailCard from '../components/LeadDetailCard';

// --- Best Practice: Define constants and schemas outside the component ---
// This prevents them from being recreated on every render.

// Validation schema for order creation
const orderSchema = yup.object({
  ftd: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  filler: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  cold: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  live: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  priority: yup.string().oneOf(['low', 'medium', 'high'], 'Invalid priority').default('medium'),
  notes: yup.string(),
  country: yup.string().nullable(),
  gender: yup.string().oneOf(['', 'male', 'female', 'not_defined'], 'Invalid gender').nullable().default(''),
  excludeClients: yup.array().of(yup.string()).default([]),
  excludeBrokers: yup.array().of(yup.string()).default([]),
  excludeNetworks: yup.array().of(yup.string()).default([]),
}).test('at-least-one', 'At least one lead type must be requested', (value) => {
  return (value.ftd || 0) + (value.filler || 0) + (value.cold || 0) + (value.live || 0) > 0;
});

// Helper functions for status/priority colors
const getStatusColor = (status) => {
  const colors = {
    fulfilled: 'success',
    pending: 'warning',
    cancelled: 'error',
    partial: 'info',
  };
  return colors[status] || 'default';
};

const getPriorityColor = (priority) => {
  const colors = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  };
  return colors[priority] || 'default';
};

// --- Optimization: Custom hook for debouncing input ---
// This prevents rapid API calls while the user is typing in filters.
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};


// --- Suggestion: This component is large. Consider splitting it into smaller components: ---
// - OrderFilters.jsx
// - OrderTable.jsx
// - OrderTableRow.jsx (to handle row logic and expansion)
// - CreateOrderDialog.jsx
// - ViewOrderDialog.jsx

const OrdersPage = () => {
  const user = useSelector(selectUser);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', severity: 'info' });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignClientDialogOpen, setAssignClientDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderForClient, setSelectedOrderForClient] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [isAssigningClient, setIsAssigningClient] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Exclusion options state
  const [exclusionOptions, setExclusionOptions] = useState({
    clients: [],
    brokers: [],
    networks: [],
  });
  const [loadingExclusionOptions, setLoadingExclusionOptions] = useState(false);

  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    startDate: '',
    endDate: '',
  });
  const debouncedFilters = useDebounce(filters, 500); // Debounce filter state
  const [showFilters, setShowFilters] = useState(false);

  // --- Bug Fix: Use an object to store data for each expanded row individually ---
  const [expandedRowData, setExpandedRowData] = useState({});

  // State for individual lead expansion within orders
  const [expandedLeads, setExpandedLeads] = useState({});

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(orderSchema),
    defaultValues: orderSchema.getDefault(),
  });

  // --- Optimization: `useCallback` to memoize functions ---
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setNotification({ message: '', severity: 'info' });
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
      });

      // Append non-empty filter values from the debounced state
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const response = await api.get(`/orders?${params}`);
      setOrders(response.data.data);
      setTotalOrders(response.data.pagination.total);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch orders',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedFilters]);

  // Effect for fetching orders when dependencies change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Effect for auto-clearing notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: '', severity: 'info' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.message]);

  // Fetch exclusion options
  const fetchExclusionOptions = useCallback(async () => {
    setLoadingExclusionOptions(true);
    try {
      const response = await api.get('/orders/exclusion-options');
      setExclusionOptions(response.data.data);
    } catch (err) {
      console.error('Failed to fetch exclusion options:', err);
      setNotification({
        message: 'Failed to load exclusion options',
        severity: 'warning',
      });
    } finally {
      setLoadingExclusionOptions(false);
    }
  }, []);

  const onSubmitOrder = useCallback(async (data) => {
    try {
      // Security Best Practice: The backend MUST validate the user's role before processing the creation.
      const orderData = {
        requests: {
          ftd: data.ftd || 0,
          filler: data.filler || 0,
          cold: data.cold || 0,
          live: data.live || 0,
        },
        priority: data.priority,
        notes: data.notes,
        country: data.country || null,
        gender: data.gender || null,
        excludeClients: data.excludeClients || [],
        excludeBrokers: data.excludeBrokers || [],
        excludeNetworks: data.excludeNetworks || [],
      };

      await api.post('/orders', orderData);
      setNotification({ message: 'Order created successfully!', severity: 'success' });
      setCreateDialogOpen(false);
      reset();
      fetchOrders(); // Refresh the list
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to create order',
        severity: 'error',
      });
    }
  }, [reset, fetchOrders]);

  const handleViewOrder = useCallback(async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch order details',
        severity: 'error',
      });
    }
  }, []);

  const toggleLeadExpansion = useCallback((leadId) => {
    setExpandedLeads(prev => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
  }, []);

  const expandAllLeads = useCallback((leads) => {
    const expandedState = {};
    leads.forEach(lead => {
      expandedState[lead._id] = true;
    });
    setExpandedLeads(prev => ({ ...prev, ...expandedState }));
  }, []);

  const collapseAllLeads = useCallback((leads) => {
    const collapsedState = {};
    leads.forEach(lead => {
      collapsedState[lead._id] = false;
    });
    setExpandedLeads(prev => ({ ...prev, ...collapsedState }));
  }, []);

  const handleExportLeads = useCallback(async (orderId) => {
    try {
      setNotification({ message: 'Preparing CSV export...', severity: 'info' });

      const response = await api.get(`/orders/${orderId}/export`, {
        responseType: 'blob', // Important for file downloads
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Get filename from response header or create default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `order_${orderId}_leads_${new Date().toISOString().split('T')[0]}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setNotification({ message: 'CSV export completed successfully!', severity: 'success' });
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to export leads',
        severity: 'error',
      });
    }
  }, []);

  const toggleRowExpansion = useCallback(async (orderId) => {
    const isCurrentlyExpanded = !!expandedRowData[orderId];
    if (isCurrentlyExpanded) {
      // Collapse the row by removing its data
      const newExpandedData = { ...expandedRowData };
      delete newExpandedData[orderId];
      setExpandedRowData(newExpandedData);
    } else {
      // Expand the row: fetch its details and store them
      try {
        const response = await api.get(`/orders/${orderId}`);
        setExpandedRowData(prev => ({ ...prev, [orderId]: response.data.data }));
      } catch (err) {
        setNotification({
          message: 'Could not load order details for expansion.',
          severity: 'error'
        });
      }
    }
  }, [expandedRowData]);

  // Pagination handlers
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Filter handlers
  const handleFilterChange = useCallback((field) => (event) => {
    const value = event.target.value;
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ status: '', priority: '', startDate: '', endDate: '' });
    setPage(0);
  }, []);

  // Client assignment handlers
  const handleOpenAssignClientDialog = useCallback(async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrderForClient(response.data.data);
      setAssignClientDialogOpen(true);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch order details',
        severity: 'error',
      });
    }
  }, []);

  const handleAssignClientInfo = useCallback(async (clientData) => {
    if (!selectedOrderForClient) return;

    setIsAssigningClient(true);
    try {
      const response = await api.put(`/orders/${selectedOrderForClient._id}/assign-client-info`, clientData);
      setNotification({
        message: response.data.message || 'Client information assigned successfully!',
        severity: 'success'
      });
      setAssignClientDialogOpen(false);
      setSelectedOrderForClient(null);
      fetchOrders(); // Refresh the orders list
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to assign client information',
        severity: 'error',
      });
    } finally {
      setIsAssigningClient(false);
    }
  }, [selectedOrderForClient, fetchOrders]);

  const handleCloseAssignClientDialog = useCallback(() => {
    setAssignClientDialogOpen(false);
    setSelectedOrderForClient(null);
  }, []);

  // Delete order handlers
  const handleOpenDeleteDialog = useCallback(async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setOrderToDelete(response.data.data);
      setDeleteDialogOpen(true);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch order details',
        severity: 'error',
      });
    }
  }, []);

  const handleDeleteOrder = useCallback(async () => {
    if (!orderToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post(`/orders/${orderToDelete._id}/delete`);
      setNotification({
        message: response.data.message || 'Order and associated leads deleted successfully!',
        severity: 'success'
      });
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      fetchOrders(); // Refresh the orders list
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to delete order',
        severity: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [orderToDelete, fetchOrders]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  }, []);

  // Handle opening create dialog and fetching exclusion options
  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
    fetchExclusionOptions();
  }, [fetchExclusionOptions]);

  // Readability: Helper component for rendering lead counts
  const renderLeadCounts = (label, requested, fulfilled) => (
    <Typography variant="body2">
      {label}: {requested || 0} requested, {fulfilled || 0} fulfilled
    </Typography>
  );

  return (
    <Box sx={{ p: isSmallScreen ? 2 : 3 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexDirection={isSmallScreen ? 'column' : 'row'}
        sx={{ mb: 3, alignItems: isSmallScreen ? 'flex-start' : 'center' }}
      >
        <Typography variant={isSmallScreen ? 'h5' : 'h4'} gutterBottom sx={{ mb: isSmallScreen ? 2 : 0 }}>
          Orders
        </Typography>
        {(user?.role === 'admin' || user?.role === 'affiliate_manager') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            size={isSmallScreen ? 'small' : 'medium'}
            sx={{ width: isSmallScreen ? '100%' : 'auto' }}
          >
            Create Order
          </Button>
        )}
      </Box>

      {/* Unified Notification Alert */}
      {notification.message && (
        <Collapse in={!!notification.message}>
          <Alert
            severity={notification.severity}
            sx={{ mb: 2 }}
            onClose={() => setNotification({ message: '', severity: 'info' })}
          >
            {notification.message}
          </Alert>
        </Collapse>
      )}

      {/* Filters Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: isSmallScreen ? 1.5 : 2, '&:last-child': { pb: isSmallScreen ? 1.5 : 2 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showFilters}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={filters.status} label="Status" onChange={handleFilterChange('status')}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="fulfilled">Fulfilled</MenuItem>
                    <MenuItem value="partial">Partial</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select value={filters.priority} label="Priority" onChange={handleFilterChange('priority')}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth label="Start Date" type="date" value={filters.startDate} onChange={handleFilterChange('startDate')} InputLabelProps={{ shrink: true }} size="small"/>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth label="End Date" type="date" value={filters.endDate} onChange={handleFilterChange('endDate')} InputLabelProps={{ shrink: true }} size="small" />
              </Grid>
              <Grid item xs={12}>
                <Button onClick={clearFilters} variant="outlined" size="small">Clear Filters</Button>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Paper>
        <TableContainer>
          <Table size={isSmallScreen ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Requester</TableCell>
                <TableCell>Requests (F/Fi/C/L)</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Fulfilled (F/Fi/C/L)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Priority</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">No orders found</TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const isExpanded = !!expandedRowData[order._id];
                  const expandedDetails = expandedRowData[order._id];

                  return (
                    <React.Fragment key={order._id}>
                      <TableRow hover>
                        <TableCell>{order._id.slice(-8)}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{order.requester?.fullName}</TableCell>
                        <TableCell>{`${order.requests?.ftd || 0}/${order.requests?.filler || 0}/${order.requests?.cold || 0}/${order.requests?.live || 0}`}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{`${order.fulfilled?.ftd || 0}/${order.fulfilled?.filler || 0}/${order.fulfilled?.cold || 0}/${order.fulfilled?.live || 0}`}</TableCell>
                        <TableCell><Chip label={order.status} color={getStatusColor(order.status)} size="small" /></TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}><Chip label={order.priority} color={getPriorityColor(order.priority)} size="small" /></TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleViewOrder(order._id)} title="View Order"><ViewIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleExportLeads(order._id)} title="Export Leads as CSV"><DownloadIcon fontSize="small" /></IconButton>
                          {order.leads && order.leads.length > 0 && (
                            <IconButton size="small" onClick={() => handleOpenAssignClientDialog(order._id)} title="Assign Client Info to All Leads"><AssignmentIcon fontSize="small" /></IconButton>
                          )}
                          <IconButton size="small" onClick={() => handleOpenDeleteDialog(order._id)} title="Delete Order and Leads" color="error"><DeleteIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => toggleRowExpansion(order._id)} title={isExpanded ? "Collapse" : "Expand"}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      {/* Expanded Row with details */}
                      <TableRow>
                        <TableCell sx={{ p: 0, borderBottom: 'none' }} colSpan={8}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                              <Typography variant="h6" gutterBottom>Order Details</Typography>
                              {expandedDetails ? (
                                <Grid container spacing={2}>
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="body2"><strong>Notes:</strong> {expandedDetails.notes || 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>Country Filter:</strong> {expandedDetails.countryFilter || 'Any'}</Typography>
                                    <Typography variant="body2"><strong>Gender Filter:</strong> {expandedDetails.genderFilter || 'Any'}</Typography>
                                  </Grid>
                                  <Grid item xs={12} md={6}>
                                      <Typography variant="body2"><strong>Assigned Leads:</strong> {expandedDetails.leads?.length || 0}</Typography>
                                      {/* Information hidden on small screens now visible here */}
                                      <Box sx={{ display: { sm: 'none' } }}>
                                          <Typography variant="body2"><strong>Priority:</strong> {expandedDetails.priority}</Typography>
                                          <Typography variant="body2"><strong>Created:</strong> {new Date(expandedDetails.createdAt).toLocaleString()}</Typography>
                                          <Typography variant="body2"><strong>Fulfilled:</strong> {`${expandedDetails.fulfilled?.ftd || 0}/${expandedDetails.fulfilled?.filler || 0}/${expandedDetails.fulfilled?.cold || 0}/${expandedDetails.fulfilled?.live || 0}`}</Typography>
                                      </Box>
                                  </Grid>
                                  {expandedDetails.leads && expandedDetails.leads.length > 0 && (
                                    <Grid item xs={12}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="subtitle2">Assigned Leads</Typography>
                                        <Button
                                          size="small"
                                          startIcon={<DownloadIcon />}
                                          onClick={() => handleExportLeads(order._id)}
                                          variant="outlined"
                                          sx={{ mr: 1 }}
                                        >
                                          Export CSV
                                        </Button>
                                        <Button
                                          size="small"
                                          onClick={() => expandAllLeads(expandedDetails.leads)}
                                          variant="outlined"
                                          sx={{ mr: 1 }}
                                        >
                                          Expand All
                                        </Button>
                                        <Button
                                          size="small"
                                          onClick={() => collapseAllLeads(expandedDetails.leads)}
                                          variant="outlined"
                                        >
                                          Collapse All
                                        </Button>
                                      </Box>
                                      <TableContainer component={Paper} elevation={2}>
                                        <Table size="small">
                                          <TableHead>
                                            <TableRow>
                                              <TableCell>Type</TableCell>
                                              <TableCell>Name</TableCell>
                                              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Country</TableCell>
                                              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                                              <TableCell>Actions</TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {expandedDetails.leads.map((lead) => (
                                              <React.Fragment key={lead._id}>
                                                <TableRow>
                                                  <TableCell><Chip label={lead.leadType?.toUpperCase()} size="small" /></TableCell>
                                                  <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                                                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.country}</TableCell>
                                                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.newEmail}</TableCell>
                                                  <TableCell>
                                                    <IconButton
                                                      size="small"
                                                      onClick={() => toggleLeadExpansion(lead._id)}
                                                      aria-label={expandedLeads[lead._id] ? 'collapse' : 'expand'}
                                                    >
                                                      {expandedLeads[lead._id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    </IconButton>
                                                  </TableCell>
                                                </TableRow>
                                                {expandedLeads[lead._id] && (
                                                  <TableRow>
                                                    <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                                                      <Collapse in={expandedLeads[lead._id]} timeout="auto" unmountOnExit>
                                                        <Box sx={{ p: 2 }}>
                                                          <LeadDetailCard lead={lead} />
                                                        </Box>
                                                      </Collapse>
                                                    </TableCell>
                                                  </TableRow>
                                                )}
                                              </React.Fragment>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </TableContainer>
                                    </Grid>
                                  )}
                                </Grid>
                              ) : (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                  <CircularProgress />
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalOrders}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Order</DialogTitle>
        <form onSubmit={handleSubmit(onSubmitOrder)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}><Controller name="ftd" control={control} render={({ field }) => <TextField {...field} fullWidth label="FTD" type="number" error={!!errors.ftd} helperText={errors.ftd?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
              <Grid item xs={6} sm={3}><Controller name="filler" control={control} render={({ field }) => <TextField {...field} fullWidth label="Filler" type="number" error={!!errors.filler} helperText={errors.filler?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
              <Grid item xs={6} sm={3}><Controller name="cold" control={control} render={({ field }) => <TextField {...field} fullWidth label="Cold" type="number" error={!!errors.cold} helperText={errors.cold?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
              <Grid item xs={6} sm={3}><Controller name="live" control={control} render={({ field }) => <TextField {...field} fullWidth label="Live" type="number" error={!!errors.live} helperText={errors.live?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="priority" control={control} render={({ field }) => (
                  <FormControl fullWidth size="small" error={!!errors.priority}>
                    <InputLabel>Priority</InputLabel>
                    <Select {...field} label="Priority"><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem></Select>
                  </FormControl>
                )}/>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller name="gender" control={control} render={({ field }) => (
                  <FormControl fullWidth size="small" error={!!errors.gender}>
                    <InputLabel>Gender (Optional)</InputLabel>
                    <Select {...field} label="Gender (Optional)"><MenuItem value="">All</MenuItem><MenuItem value="male">Male</MenuItem><MenuItem value="female">Female</MenuItem><MenuItem value="not_defined">Not Defined</MenuItem></Select>
                  </FormControl>
                )}/>
              </Grid>
              <Grid item xs={12}>
                <Controller name="country" control={control} render={({ field }) => (
                  <FormControl fullWidth size="small" error={!!errors.country}>
                    <InputLabel>Country Filter (Optional)</InputLabel>
                    <Select
                      {...field}
                      label="Country Filter (Optional)"
                      value={field.value || ''}
                    >
                      <MenuItem value="">All Countries</MenuItem>
                      {getSortedCountries().map((country) => (
                        <MenuItem key={country.code} value={country.name}>
                          {country.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.country?.message && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                        {errors.country.message}
                      </Typography>
                    )}
                    {!errors.country?.message && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                        Leave empty for all countries
                      </Typography>
                    )}
                  </FormControl>
                )}/>
              </Grid>
              <Grid item xs={12}>
                <Controller name="notes" control={control} render={({ field }) => <TextField {...field} fullWidth label="Notes" multiline rows={3} error={!!errors.notes} helperText={errors.notes?.message} size="small" />}/>
              </Grid>

              {/* Exclusion Filters Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Exclusion Filters (Optional)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Exclude leads that have been previously assigned to these destinations. This prevents sending the same lead to the same client/broker/network twice.
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Controller
                  name="excludeClients"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.excludeClients}>
                      <InputLabel>Exclude Clients</InputLabel>
                      <Select
                        {...field}
                        multiple
                        label="Exclude Clients"
                        value={field.value || []}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                        disabled={loadingExclusionOptions}
                      >
                        {exclusionOptions.clients.map((client) => (
                          <MenuItem key={client} value={client}>
                            {client}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.excludeClients && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                          {errors.excludeClients.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Controller
                  name="excludeBrokers"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.excludeBrokers}>
                      <InputLabel>Exclude Brokers</InputLabel>
                      <Select
                        {...field}
                        multiple
                        label="Exclude Brokers"
                        value={field.value || []}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                        disabled={loadingExclusionOptions}
                      >
                        {exclusionOptions.brokers.map((broker) => (
                          <MenuItem key={broker} value={broker}>
                            {broker}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.excludeBrokers && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                          {errors.excludeBrokers.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Controller
                  name="excludeNetworks"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.excludeNetworks}>
                      <InputLabel>Exclude Networks</InputLabel>
                      <Select
                        {...field}
                        multiple
                        label="Exclude Networks"
                        value={field.value || []}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                        disabled={loadingExclusionOptions}
                      >
                        {exclusionOptions.networks.map((network) => (
                          <MenuItem key={network} value={network}>
                            {network}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.excludeNetworks && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                          {errors.excludeNetworks.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>
            {errors[''] && <Alert severity="error" sx={{ mt: 2 }}>{errors['']?.message}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={24} /> : 'Create Order'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Order Details</DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Order ID</Typography><Typography variant="body2">{selectedOrder._id}</Typography></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Requester</Typography><Typography variant="body2">{selectedOrder.requester?.fullName} ({selectedOrder.requester?.email})</Typography></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Status</Typography><Chip label={selectedOrder.status} color={getStatusColor(selectedOrder.status)} size="small" /></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Priority</Typography><Chip label={selectedOrder.priority} color={getPriorityColor(selectedOrder.priority)} size="small" /></Grid>
              <Grid item xs={12}><Typography variant="subtitle2">Requests vs Fulfilled</Typography>
                {renderLeadCounts('FTD', selectedOrder.requests?.ftd, selectedOrder.fulfilled?.ftd)}
                {renderLeadCounts('Filler', selectedOrder.requests?.filler, selectedOrder.fulfilled?.filler)}
                {renderLeadCounts('Cold', selectedOrder.requests?.cold, selectedOrder.fulfilled?.cold)}
                {renderLeadCounts('Live', selectedOrder.requests?.live, selectedOrder.fulfilled?.live)}
              </Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Country Filter</Typography><Typography variant="body2">{selectedOrder.countryFilter || 'Any'}</Typography></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Gender Filter</Typography><Typography variant="body2">{selectedOrder.genderFilter || 'Any'}</Typography></Grid>

              {/* Show exclusion filters if any were applied */}
              {(selectedOrder.excludeClients?.length > 0 || selectedOrder.excludeBrokers?.length > 0 || selectedOrder.excludeNetworks?.length > 0) && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Exclusion Filters Applied</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedOrder.excludeClients?.length > 0 && (
                      <Box>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>Excluded Clients: </Typography>
                        {selectedOrder.excludeClients.map((client, index) => (
                          <Chip key={client} label={client} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    )}
                    {selectedOrder.excludeBrokers?.length > 0 && (
                      <Box>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>Excluded Brokers: </Typography>
                        {selectedOrder.excludeBrokers.map((broker, index) => (
                          <Chip key={broker} label={broker} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    )}
                    {selectedOrder.excludeNetworks?.length > 0 && (
                      <Box>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>Excluded Networks: </Typography>
                        {selectedOrder.excludeNetworks.map((network, index) => (
                          <Chip key={network} label={network} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Grid>
              )}
              <Grid item xs={12}><Typography variant="subtitle2">Notes</Typography><Typography variant="body2">{selectedOrder.notes || 'N/A'}</Typography></Grid>
              <Grid item xs={12}><Typography variant="subtitle2">Created</Typography><Typography variant="body2">{new Date(selectedOrder.createdAt).toLocaleString()}</Typography></Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">Assigned Leads ({selectedOrder.leads?.length || 0})</Typography>
                  {selectedOrder.leads?.length > 0 && (
                    <Box>
                      <Button
                        size="small"
                        onClick={() => expandAllLeads(selectedOrder.leads)}
                        variant="outlined"
                        sx={{ mr: 1 }}
                      >
                        Expand All
                      </Button>
                      <Button
                        size="small"
                        onClick={() => collapseAllLeads(selectedOrder.leads)}
                        variant="outlined"
                      >
                        Collapse All
                      </Button>
                    </Box>
                  )}
                </Box>
                {selectedOrder.leads?.length > 0 ? (
                  <TableContainer component={Paper}><Table size="small">
                    <TableHead><TableRow>
                      <TableCell>Type</TableCell><TableCell>Name</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Country</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {selectedOrder.leads.map((lead) => (
                        <React.Fragment key={lead._id}>
                          <TableRow>
                            <TableCell><Chip label={lead.leadType.toUpperCase()} size="small" /></TableCell>
                            <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.country}</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.newEmail}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => toggleLeadExpansion(lead._id)}
                                aria-label={expandedLeads[lead._id] ? 'collapse' : 'expand'}
                              >
                                {expandedLeads[lead._id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          {expandedLeads[lead._id] && (
                            <TableRow>
                              <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                                <Collapse in={expandedLeads[lead._id]} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 2 }}>
                                    <LeadDetailCard lead={lead} />
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table></TableContainer>
                ) : <Typography variant="body2">No leads assigned</Typography>}
              </Grid>
            </Grid>
          )}
        </DialogContent>
                  <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button
              onClick={() => handleExportLeads(selectedOrder._id)}
              startIcon={<DownloadIcon />}
              variant="contained"
              color="primary"
            >
              Export Leads CSV
            </Button>
          </DialogActions>
      </Dialog>

      {/* Assign Client Info Dialog */}
      <AssignClientInfoDialog
        open={assignClientDialogOpen}
        onClose={handleCloseAssignClientDialog}
        onSubmit={handleAssignClientInfo}
        isSubmitting={isAssigningClient}
        orderData={selectedOrderForClient}
      />

      {/* Delete Order Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Delete Order</DialogTitle>
        <DialogContent dividers>
          {orderToDelete && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete this order? This action cannot be undone.
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2"><strong>Order ID:</strong> {orderToDelete._id}</Typography>
                <Typography variant="subtitle2"><strong>Requester:</strong> {orderToDelete.requester?.fullName}</Typography>
                <Typography variant="subtitle2"><strong>Leads Count:</strong> {orderToDelete.leads?.length || 0}</Typography>
                <Typography variant="subtitle2"><strong>Status:</strong> {orderToDelete.status}</Typography>
              </Box>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Warning:</strong> This will permanently:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Delete the order and all its data</li>
                  <li>Unassign all {orderToDelete.leads?.length || 0} leads from this order</li>
                  <li>Remove client, broker, and network tags from the leads</li>
                  <li><strong>Note:</strong> The leads themselves will remain in the system</li>
                </ul>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteOrder} 
            variant="contained" 
            color="error" 
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={24} /> : 'Delete Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersPage;