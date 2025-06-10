import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Stack,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  ManageAccounts as ManagerIcon,
  Support as AgentIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as RejectIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { selectUser } from '../store/slices/authSlice';

// Validation schema for user creation/editing
const userSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  fullName: yup.string().required('Full name is required').min(2, 'Name must be at least 2 characters'),
  role: yup.string().oneOf(['admin', 'affiliate_manager', 'agent'], 'Invalid role').required('Role is required'),
  fourDigitCode: yup.string().when('role', {
    is: 'agent',
    then: (schema) => schema.required('Four digit code is required for agents').length(4, 'Must be exactly 4 digits').matches(/^\d{4}$/, 'Must be 4 digits'),
    otherwise: (schema) => schema.notRequired(),
  }),
  password: yup.string().when('isEditing', {
    is: false,
    then: (schema) => schema.required('Password is required').min(6, 'Password must be at least 6 characters'),
    otherwise: (schema) => schema.notRequired(),
  }),
  isActive: yup.boolean(),
  permissions: yup.object({
    canCreateOrders: yup.boolean(),
  }),
});

const UsersPage = () => {
  const currentUser = useSelector(selectUser);
  console.log('Current user in UsersPage:', currentUser);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filters, setFilters] = useState({
    role: '',
    isActive: '',
    status: '',
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(userSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: 'agent',
      fourDigitCode: '',
      password: '',
      isActive: true,
      permissions: {
        canCreateOrders: true,
      },
      isEditing: false,
    },
  });

  const watchedRole = watch('role');

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Only include non-empty filter values
      const queryParams = {
        page: page + 1,
        limit: rowsPerPage,
      };

      // Add filters only if they have values
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
          queryParams[key] = filters[key];
        }
      });

      const params = new URLSearchParams(queryParams);

      console.log('Fetching users with params:', params.toString());
      const response = await api.get(`/users?${params}`);
      console.log('API Response:', response);
      console.log('Response data:', response.data);

      // Check if the response structure is as expected
      if (response.data && response.data.data) {
        setUsers(response.data.data);
        setTotalUsers(response.data.pagination?.totalUsers || 0);
        console.log('Users set:', response.data.data);
        console.log('Total users:', response.data.pagination?.totalUsers || 0);
      } else if (response.data && Array.isArray(response.data)) {
        // In case the API returns users directly as an array
        setUsers(response.data);
        setTotalUsers(response.data.length);
        console.log('Users set (direct array):', response.data);
      } else {
        console.warn('Unexpected response structure:', response.data);
        setUsers([]);
        setTotalUsers(0);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Fetching users - page:', page, 'rowsPerPage:', rowsPerPage, 'filters:', filters);
    fetchUsers();
  }, [page, rowsPerPage, filters]);

  // Create/Update user
  const onSubmitUser = async (data) => {
    try {
      setError(null);
      const userData = {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        isActive: data.isActive,
        permissions: data.permissions,
      };

      if (data.role === 'agent' && data.fourDigitCode) {
        userData.fourDigitCode = data.fourDigitCode;
      }

      if (!isEditing) {
        userData.password = data.password;
      }

      if (isEditing) {
        await api.put(`/users/${selectedUser._id}`, userData);
        setSuccess('User updated successfully!');
      } else {
        await api.post('/users', userData);
        setSuccess('User created successfully!');
      }

      setUserDialogOpen(false);
      reset();
      fetchUsers();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save user');
    }
  };

  // Delete (deactivate) user
  const handleDeleteUser = async () => {
    try {
      setError(null);
      await api.delete(`/users/${selectedUser._id}`);
      setSuccess('User deactivated successfully!');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  // Open create dialog
  const handleCreateUser = () => {
    setIsEditing(false);
    setSelectedUser(null);
    reset({
      email: '',
      fullName: '',
      role: 'agent',
      fourDigitCode: '',
      password: '',
      isActive: true,
      permissions: {
        canCreateOrders: true,
      },
      isEditing: false,
    });
    setUserDialogOpen(true);
  };

  // Open edit dialog
  const handleEditUser = (user) => {
    setIsEditing(true);
    setSelectedUser(user);
    reset({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      fourDigitCode: user.fourDigitCode || '',
      password: '',
      isActive: user.isActive,
      permissions: user.permissions || { canCreateOrders: true },
      isEditing: true,
    });
    setUserDialogOpen(true);
  };

  // Open delete dialog
  const handleDeleteDialog = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Approve user
  const handleApproveUser = async (role) => {
    try {
      setError(null);
      await api.put(`/users/${selectedUser._id}/approve`, { role });
      setSuccess('User approved successfully!');
      setApproveDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve user');
    }
  };

  // Open approve dialog
  const handleApproveDialog = (user) => {
    setSelectedUser(user);
    setApproveDialogOpen(true);
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
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      role: '',
      isActive: '',
      status: '',
    });
    setPage(0);
  };

  // Role icon mapping
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <AdminIcon color="primary" />;
      case 'affiliate_manager': return <ManagerIcon color="secondary" />;
      case 'agent': return <AgentIcon color="info" />;
      default: return <PersonIcon />;
    }
  };

  // Role color mapping
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'primary';
      case 'affiliate_manager': return 'secondary';
      case 'agent': return 'info';
      default: return 'default';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircleIcon />;
      case 'pending': return <PendingIcon />;
      case 'rejected': return <RejectIcon />;
      default: return <PendingIcon />;
    }
  };

  const canManageUsers = currentUser?.role === 'admin';

  if (!canManageUsers) {
    return (
      <Box>
        <Alert severity="error">
          You don't have permission to access user management.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          User Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateUser}
        >
          Add User
        </Button>
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
        <CardContent>
          <Typography variant="h6" gutterBottom>Filters</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={filters.role}
                  label="Role"
                  onChange={handleFilterChange('role')}
                >
                  <MenuItem value="">All Roles</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="affiliate_manager">Affiliate Manager</MenuItem>
                  <MenuItem value="agent">Agent</MenuItem>
                  <MenuItem value="pending_approval">Pending Approval</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={handleFilterChange('status')}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Activity</InputLabel>
                <Select
                  value={filters.isActive}
                  label="Activity"
                  onChange={handleFilterChange('isActive')}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Active</MenuItem>
                  <MenuItem value="false">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button onClick={clearFilters} variant="outlined">
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Agent Code</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Activity</TableCell>
                <TableCell>Permissions</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ mr: 2 }}>
                          {getRoleIcon(user.role)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {user.fullName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {user._id.slice(-8)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role === 'pending_approval' ? 'PENDING APPROVAL' : user.role.replace('_', ' ').toUpperCase()}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.fourDigitCode ? (
                        <Chip
                          label={user.fourDigitCode}
                          variant="outlined"
                          size="small"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.status ? user.status.toUpperCase() : 'PENDING'}
                        color={getStatusColor(user.status)}
                        size="small"
                        icon={getStatusIcon(user.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {user.permissions?.canCreateOrders && (
                          <Chip
                            label="Create Orders"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {user.status === 'pending' && (
                          <Tooltip title="Approve User">
                            <IconButton
                              size="small"
                              onClick={() => handleApproveDialog(user)}
                              color="success"
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit User">
                          <IconButton
                            size="small"
                            onClick={() => handleEditUser(user)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        {user._id !== currentUser.id && (
                          <Tooltip title="Deactivate User">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteDialog(user)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalUsers}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Create/Edit User Dialog */}
      <Dialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isEditing ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmitUser)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="fullName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Full Name"
                      error={!!errors.fullName}
                      helperText={errors.fullName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email"
                      type="email"
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.role}>
                      <InputLabel>Role</InputLabel>
                      <Select
                        {...field}
                        label="Role"
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="affiliate_manager">Affiliate Manager</MenuItem>
                        <MenuItem value="agent">Agent</MenuItem>
                      </Select>
                      {errors.role && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                          {errors.role.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
              {watchedRole === 'agent' && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="fourDigitCode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="4-Digit Code"
                        placeholder="1234"
                        inputProps={{ maxLength: 4 }}
                        error={!!errors.fourDigitCode}
                        helperText={errors.fourDigitCode?.message}
                      />
                    )}
                  />
                </Grid>
              )}
              {!isEditing && (
                <Grid item xs={12}>
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Password"
                        type="password"
                        error={!!errors.password}
                        helperText={errors.password?.message}
                      />
                    )}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Active"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Permissions
                </Typography>
                <Controller
                  name="permissions.canCreateOrders"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Can Create Orders"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <CircularProgress size={24} />
              ) : (
                isEditing ? 'Update User' : 'Create User'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
      >
        <DialogTitle>Confirm Deactivation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate user "{selectedUser?.fullName}"?
            This action will disable their access to the system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve User Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
      >
        <DialogTitle>Approve User</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Approve user "{selectedUser?.fullName}" and assign them a role:
          </Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => handleApproveUser('admin')}
              startIcon={<AdminIcon />}
              fullWidth
            >
              Approve as Admin
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleApproveUser('affiliate_manager')}
              startIcon={<ManagerIcon />}
              fullWidth
            >
              Approve as Affiliate Manager
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleApproveUser('agent')}
              startIcon={<AgentIcon />}
              fullWidth
            >
              Approve as Agent
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;