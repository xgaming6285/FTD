import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
  Stack,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { selectUser } from '../store/slices/authSlice';

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  const debouncedFunction = function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
  debouncedFunction.cancel = function () {
    clearTimeout(timeout);
  };
  return debouncedFunction;
}

// Validation schema for order creation
const orderSchema = yup.object({
  ftd: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number'),
  filler: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number'),
  cold: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number'),
  live: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number'),
  priority: yup.string().oneOf(['low', 'medium', 'high'], 'Invalid priority'),
  notes: yup.string(),
  country: yup.string().nullable(),
  gender: yup.string().oneOf(['male', 'female', 'not_defined'], 'Invalid gender').nullable(),
}).test('at-least-one', 'At least one lead type must be requested', function (value) {
  return (value.ftd || 0) + (value.filler || 0) + (value.cold || 0) + (value.live || 0) > 0;
});

const OrdersPage = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(orderSchema),
    defaultValues: {
      ftd: 0,
      filler: 0,
      cold: 0,
      live: 0,
      priority: 'medium',
      notes: '',
      country: '',
      gender: '',
    },
  });

  // Add debounce timer ref
  const fetchTimer = useRef(null);

  // Modified fetch orders with debouncing
  const fetchOrders = async () => {
    if (fetchTimer.current) {
      clearTimeout(fetchTimer.current);
    }

    fetchTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        // Create base params
        const params = new URLSearchParams({
          page: page + 1,
          limit: rowsPerPage,
        });

        // Only add non-empty filter values
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });

        const response = await api.get(`/orders?${params}`);
        setOrders(response.data.data);
        setTotalOrders(response.data.pagination.total);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce delay
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fetchTimer.current) {
        clearTimeout(fetchTimer.current);
      }
    };
  }, []);

  // Watch for changes in filters and pagination
  useEffect(() => {
    fetchOrders();
  }, [page, rowsPerPage, filters.status, filters.priority, filters.startDate, filters.endDate]); // Включени и date filters

  // Create order
  const onSubmitOrder = async (data) => {
    try {
      setError(null);
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
      };

      await api.post('/orders', orderData);
      setSuccess('Order created successfully!');
      setCreateDialogOpen(false);
      reset();
      fetchOrders();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
    }
  };

  // View order details
  const handleViewOrder = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch order details');
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

  // Filter handlers with debounce
  const handleFilterChange = (field) => (event) => {
    const value = event.target.value;
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      startDate: '',
      endDate: '',
    });
    setPage(0);
  };

  // Toggle row expansion
  const toggleRowExpansion = (orderId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedRows(newExpanded);
  };

  // Status color mapping
  const getStatusColor = (status) => {
    switch (status) {
      case 'fulfilled': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      case 'partial': return 'info';
      default: return 'default';
    }
  };

  // Priority color mapping
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: isSmallScreen ? 2 : 3, maxWidth: '100%', mx: 'auto', padding: '0px' }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexDirection={isSmallScreen ? 'column' : 'row'}
        sx={{
          mb: isSmallScreen ? 2 : 3,
          alignItems: isSmallScreen ? 'flex-start' : 'center',
        }}
      >
        <Typography variant={isSmallScreen ? 'h5' : 'h4'} gutterBottom sx={{ mb: isSmallScreen ? 1 : 0 }}>
          Orders
        </Typography>
        {(user?.role === 'admin' || user?.role === 'affiliate_manager') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            size={isSmallScreen ? 'small' : 'medium'}
            sx={{ width: isSmallScreen ? '100%' : 'auto' }}
          >
            Create Order
          </Button>
        )}
      </Box>

      {/* Success/Error Messages */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}> {/* Адаптивен padding в CardContent */}
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: isSmallScreen ? 1 : 0 }}>
            <Typography variant={isSmallScreen ? 'h6' : 'h5'}>Filters</Typography>
            <IconButton size={isSmallScreen ? 'small' : 'medium'} onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showFilters}>
            <Grid container spacing={isSmallScreen ? 1 : 2} sx={{ mt: isSmallScreen ? 1 : 1 }}>
              {/* Filter items - all will be xs={12} for full width on mobile */}
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size={isSmallScreen ? 'small' : 'medium'}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={handleFilterChange('status')}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="fulfilled">Fulfilled</MenuItem>
                    <MenuItem value="partial">Partial</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size={isSmallScreen ? 'small' : 'medium'}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    label="Priority"
                    onChange={handleFilterChange('priority')}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={filters.startDate}
                  onChange={handleFilterChange('startDate')}
                  InputLabelProps={{ shrink: true }}
                  size={isSmallScreen ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={filters.endDate}
                  onChange={handleFilterChange('endDate')}
                  InputLabelProps={{ shrink: true }}
                  size={isSmallScreen ? 'small' : 'medium'}
                />
              </Grid>
              <Grid item xs={12}>
                <Button onClick={clearFilters} variant="outlined" size={isSmallScreen ? 'small' : 'medium'}>
                  Clear Filters
                </Button>
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

                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>Order ID</TableCell>
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit', display: isSmallScreen ? 'none' : 'table-cell' }}>Requester</TableCell> {/* Скриване на мобилни устройства */}
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>Requests (F/Fi/C/L)</TableCell>
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit', display: isSmallScreen ? 'none' : 'table-cell' }}>Fulfilled (F/Fi/C/L)</TableCell> {/* Скриване на мобилни устройства */}
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>Status</TableCell>
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit', display: isSmallScreen ? 'none' : 'table-cell' }}>Priority</TableCell> {/* Скриване на мобилни устройства */}
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit', display: isSmallScreen ? 'none' : 'table-cell' }}>Created</TableCell> {/* Скриване на мобилни устройства */}
                <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <React.Fragment key={order._id}>
                    <TableRow>
                      <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>{order._id.slice(-8)}</TableCell>
                      <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell', fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>{order.requester?.fullName}</TableCell>
                      <TableCell sx={{ fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>
                        {order.requests?.ftd || 0}/{order.requests?.filler || 0}/{order.requests?.cold || 0}/{order.requests?.live || 0}
                      </TableCell>
                      <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell', fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>
                        {order.fulfilled?.ftd || 0}/{order.fulfilled?.filler || 0}/{order.fulfilled?.cold || 0}/{order.fulfilled?.live || 0}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={order.status}
                          color={getStatusColor(order.status)}
                          size="small"
                          sx={{ fontSize: isSmallScreen ? '0.65rem' : 'inherit' }}
                        />
                      </TableCell>
                      <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                        <Chip
                          label={order.priority}
                          color={getPriorityColor(order.priority)}
                          size="small"
                          sx={{ fontSize: isSmallScreen ? '0.65rem' : 'inherit' }}
                        />
                      </TableCell>
                      <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell', fontSize: isSmallScreen ? '0.75rem' : 'inherit' }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size={isSmallScreen ? 'small' : 'medium'}
                          onClick={() => handleViewOrder(order._id)}
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton
                          size={isSmallScreen ? 'small' : 'medium'}
                          onClick={() => toggleRowExpansion(order._id)}
                        >
                          {expandedRows.has(order._id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    {/* Разширен ред за детайли */}
                    {expandedRows.has(order._id) && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Box sx={{ p: isSmallScreen ? 1 : 2, bgcolor: 'grey.50' }}>
                            <Typography variant={isSmallScreen ? 'body2' : 'subtitle2'} gutterBottom>
                              Order Details
                            </Typography>
                            <Grid container spacing={isSmallScreen ? 1 : 2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant={isSmallScreen ? 'body2' : 'body1'}>
                                  <strong>Notes:</strong> {order.notes || 'No notes'}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant={isSmallScreen ? 'body2' : 'body1'}>
                                  <strong>Leads Assigned:</strong> {order.leads?.length || 0}
                                </Typography>
                              </Grid>
                              {isSmallScreen && (
                                <>
                                  <Grid item xs={12}>
                                    <Typography variant="body2">
                                      <strong>Requester:</strong> {order.requester?.fullName}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Typography variant="body2">
                                      <strong>Fulfilled (F/Fi/C/L):</strong> {order.fulfilled?.ftd || 0}/{order.fulfilled?.filler || 0}/{order.fulfilled?.cold || 0}/{order.fulfilled?.live || 0}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Typography variant="body2">
                                      <strong>Priority:</strong> {order.priority}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Typography variant="body2">
                                      <strong>Created:</strong> {new Date(order.createdAt).toLocaleDateString()}
                                    </Typography>
                                  </Grid>
                                </>
                              )}
                            </Grid>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}

                    {expandedRows.has(order._id) && selectedOrder && selectedOrder.leads && selectedOrder.leads.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Box sx={{ p: isSmallScreen ? 1 : 2, bgcolor: 'grey.50' }}>
                            <Typography variant={isSmallScreen ? 'body2' : 'subtitle2'} gutterBottom>
                              Assigned Leads ({selectedOrder.leads?.length || 0})
                            </Typography>
                            <TableContainer component={Paper}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>Country</TableCell>
                                    <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>Email</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {selectedOrder.leads.map((lead) => (
                                    <TableRow key={lead._id}>
                                      <TableCell>
                                        <Chip label={lead.leadType.toUpperCase()} size="small" />
                                      </TableCell>
                                      <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                                      <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>{lead.country}</TableCell>
                                      <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>{lead.email}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
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
          count={totalOrders}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Create Order Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Order</DialogTitle>
        <form onSubmit={handleSubmit(onSubmitOrder)}>
          <DialogContent>
            <Grid container spacing={isSmallScreen ? 1 : 2}>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  name="ftd"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="FTD Leads"
                      type="number"
                      error={!!errors.ftd}
                      helperText={errors.ftd?.message}
                      inputProps={{ min: 0 }}
                      size={isSmallScreen ? 'small' : 'medium'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  name="filler"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Filler Leads"
                      type="number"
                      error={!!errors.filler}
                      helperText={errors.filler?.message}
                      inputProps={{ min: 0 }}
                      size={isSmallScreen ? 'small' : 'medium'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  name="cold"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Cold Leads"
                      type="number"
                      error={!!errors.cold}
                      helperText={errors.cold?.message}
                      inputProps={{ min: 0 }}
                      size={isSmallScreen ? 'small' : 'medium'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  name="live"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Live Leads"
                      type="number"
                      error={!!errors.live}
                      helperText={errors.live?.message}
                      inputProps={{ min: 0 }}
                      size={isSmallScreen ? 'small' : 'medium'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size={isSmallScreen ? 'small' : 'medium'}>
                      <InputLabel>Priority</InputLabel>
                      <Select
                        {...field}
                        label="Priority"
                        error={!!errors.priority}
                      >
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Country Filter (Optional)"
                      placeholder="e.g. Canada, USA, UK"
                      error={!!errors.country}
                      helperText={errors.country?.message || "Leave empty to include leads from all countries"}
                      size={isSmallScreen ? 'small' : 'medium'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size={isSmallScreen ? 'small' : 'medium'}>
                      <InputLabel>Gender Filter (Optional)</InputLabel>
                      <Select
                        {...field}
                        label="Gender Filter (Optional)"
                        error={!!errors.gender}
                      >
                        <MenuItem value="">All Genders</MenuItem>
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                        <MenuItem value="not_defined">Not Defined</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes"
                      multiline
                      rows={isSmallScreen ? 2 : 3}
                      error={!!errors.notes}
                      helperText={errors.notes?.message}
                      size={isSmallScreen ? 'small' : 'medium'}
                    />
                  )}
                />
              </Grid>
            </Grid>
            {errors.root && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors.root.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Create Order'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Order Details</DialogTitle>
        <DialogContent dividers sx={{ p: isSmallScreen ? 1.5 : 3 }}>
          {selectedOrder && (
            <Grid container spacing={isSmallScreen ? 1 : 2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Order ID</Typography>
                <Typography variant="body2" gutterBottom>
                  {selectedOrder._id}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Requester</Typography>
                <Typography variant="body2" gutterBottom>
                  {selectedOrder.requester?.fullName} ({selectedOrder.requester?.email})
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Status</Typography>
                <Chip
                  label={selectedOrder.status}
                  color={getStatusColor(selectedOrder.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Priority</Typography>
                <Chip
                  label={selectedOrder.priority}
                  color={getPriorityColor(selectedOrder.priority)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Requests vs Fulfilled</Typography>
                <Typography variant="body2">
                  FTD: {selectedOrder.requests?.ftd || 0} requested, {selectedOrder.fulfilled?.ftd || 0} fulfilled
                </Typography>
                <Typography variant="body2">
                  Filler: {selectedOrder.requests?.filler || 0} requested, {selectedOrder.fulfilled?.filler || 0} fulfilled
                </Typography>
                <Typography variant="body2">
                  Cold: {selectedOrder.requests?.cold || 0} requested, {selectedOrder.fulfilled?.cold || 0} fulfilled
                </Typography>
                <Typography variant="body2">
                  Live: {selectedOrder.requests?.live || 0} requested, {selectedOrder.fulfilled?.live || 0} fulfilled
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Notes</Typography>
                <Typography variant="body2" gutterBottom>
                  {selectedOrder.notes || 'No notes provided'}
                </Typography>
              </Grid>
              {selectedOrder.countryFilter && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Country Filter Used</Typography>
                  <Typography variant="body2" gutterBottom>
                    <Chip 
                      label={selectedOrder.countryFilter} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Typography>
                </Grid>
              )}
              {selectedOrder.genderFilter && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Gender Filter Used</Typography>
                  <Typography variant="body2" gutterBottom>
                    <Chip 
                      label={selectedOrder.genderFilter} 
                      size="small" 
                      color="secondary" 
                      variant="outlined"
                    />
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="subtitle2">Created</Typography>
                <Typography variant="body2" gutterBottom>
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Assigned Leads ({selectedOrder.leads?.length || 0})</Typography>
                {selectedOrder.leads && selectedOrder.leads.length > 0 ? (
                  <TableContainer component={Paper}> {/* Added TableContainer for horizontal scrolling */}
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>Country</TableCell> {/* Hide on small screens */}
                          <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>Email</TableCell> {/* Hide on small screens */}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedOrder.leads.map((lead) => (
                          <TableRow key={lead._id}>
                            <TableCell>
                              <Chip label={lead.leadType.toUpperCase()} size="small" />
                            </TableCell>
                            <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                            <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>{lead.country}</TableCell>
                            <TableCell sx={{ display: isSmallScreen ? 'none' : 'table-cell' }}>{lead.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2">No leads assigned</Typography>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersPage;