import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, Card, CardContent, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TablePagination, IconButton, FormControl, InputLabel, Select,
  MenuItem, Alert, CircularProgress, Switch, FormControlLabel, Stack,
  Avatar, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Person as PersonIcon,
  AdminPanelSettings as AdminIcon, Support as AgentIcon, CheckCircle as CheckCircleIcon,
  Pending as PendingIcon, Cancel as RejectIcon, SupervisorAccount as LeadManagerIcon,
  ManageAccounts as ManagerIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { selectUser } from '../store/slices/authSlice';

// --- Constants for Roles and Statuses for better maintainability ---
const ROLES = {
  admin: { label: 'Admin', icon: <AdminIcon />, color: 'error' },
  affiliate_manager: { label: 'Affiliate Manager', icon: <ManagerIcon />, color: 'primary' },
  lead_manager: { label: 'Lead Manager', icon: <LeadManagerIcon />, color: 'secondary' },
  agent: { label: 'Agent', icon: <AgentIcon />, color: 'success' },
  pending_approval: { label: 'Pending Approval', icon: <PersonIcon />, color: 'default' },
};

const STATUSES = {
  approved: { label: 'Approved', icon: <CheckCircleIcon />, color: 'success' },
  pending: { label: 'Pending', icon: <PendingIcon />, color: 'warning' },
  rejected: { label: 'Rejected', icon: <RejectIcon />, color: 'error' },
};

// --- Validation Schema ---
const userSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  fullName: yup.string().required('Full name is required').min(2, 'Name must be at least 2 characters'),
  role: yup.string().oneOf(Object.keys(ROLES), 'Invalid role').required('Role is required'),
  fourDigitCode: yup.string().when('role', {
    is: 'agent',
    then: (schema) => schema.required('Four digit code is required for agents').length(4, 'Must be exactly 4 digits').matches(/^\d{4}$/, 'Must be 4 digits'),
    otherwise: (schema) => schema.notRequired(),
  }),
  // Password is only required when creating a new user (_isEditing is a form-only field)
  password: yup.string().when('_isEditing', {
    is: false,
    then: (schema) => schema.required('Password is required').min(6, 'Password must be at least 6 characters'),
    otherwise: (schema) => schema.notRequired(),
  }),
  isActive: yup.boolean(),
  permissions: yup.object({
    canCreateOrders: yup.boolean(),
    canManageLeads: yup.boolean(),
  }),
});

// --- Memoized User Dialog Component ---
const UserDialog = React.memo(({ open, onClose, onSubmit, isEditing, control, errors, isSubmitting, watchedRole }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{isEditing ? 'Edit User' : 'Create User'}</DialogTitle>
    <form onSubmit={onSubmit}>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12}>
            <Controller name="fullName" control={control} render={({ field }) => (
                <TextField {...field} label="Full Name" fullWidth error={!!errors.fullName} helperText={errors.fullName?.message} />
            )}/>
          </Grid>
          <Grid item xs={12}>
             <Controller name="email" control={control} render={({ field }) => (
                <TextField {...field} label="Email" fullWidth error={!!errors.email} helperText={errors.email?.message} disabled={isEditing} />
            )}/>
          </Grid>
          {!isEditing && (
            <Grid item xs={12}>
              <Controller name="password" control={control} render={({ field }) => (
                  <TextField {...field} type="password" label="Password" fullWidth error={!!errors.password} helperText={errors.password?.message} />
              )}/>
            </Grid>
          )}
          <Grid item xs={12}>
            <Controller name="role" control={control} render={({ field }) => (
              <FormControl fullWidth error={!!errors.role}>
                <InputLabel>Role</InputLabel>
                <Select {...field} label="Role">
                  {Object.entries(ROLES).filter(([key]) => key !== 'pending_approval').map(([key, { label }]) => (
                    <MenuItem key={key} value={key}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}/>
          </Grid>
          {watchedRole === 'agent' && (
            <Grid item xs={12}>
              <Controller name="fourDigitCode" control={control} render={({ field }) => (
                <TextField {...field} label="Four Digit Code" fullWidth error={!!errors.fourDigitCode} helperText={errors.fourDigitCode?.message} />
              )}/>
            </Grid>
          )}
           <Grid item xs={12} sm={6}>
              <Controller name="isActive" control={control} render={({ field: { value, onChange } }) => (
                <FormControlLabel control={<Switch checked={!!value} onChange={e => onChange(e.target.checked)} />} label="Active" />
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="permissions.canCreateOrders" control={control} render={({ field: { value, onChange } }) => (
                <FormControlLabel control={<Switch checked={!!value} onChange={e => onChange(e.target.checked)} />} label="Can Create Orders" />
              )}/>
            </Grid>
            {(watchedRole === 'lead_manager' || watchedRole === 'admin') && (
              <Grid item xs={12} sm={6}>
                <Controller name="permissions.canManageLeads" control={control} render={({ field: { value, onChange } }) => (
                   <FormControlLabel control={<Switch checked={!!value} onChange={e => onChange(e.target.checked)} />} label="Can Manage Leads" />
                )}/>
              </Grid>
            )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={24} /> : (isEditing ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </form>
  </Dialog>
));

const UsersPage = () => {
  const currentUser = useSelector(selectUser);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [dialogState, setDialogState] = useState({ type: null, user: null });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filters, setFilters] = useState({ role: '', isActive: '', status: '' });

  const { control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(userSchema),
    defaultValues: {
      email: '', fullName: '', role: 'agent', fourDigitCode: '',
      password: '', isActive: true, permissions: { canCreateOrders: true, canManageLeads: false },
      _isEditing: false,
    },
  });
  const watchedRole = watch('role');

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };
  
  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const queryParams = { page: page + 1, limit: rowsPerPage, ...filters };
      const activeParams = Object.fromEntries(Object.entries(queryParams).filter(([, v]) => v !== ''));
      const response = await api.get('/users', { params: activeParams });
      setUsers(response.data.data);
      setTotalUsers(response.data.pagination?.totalUsers || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // Effect to reset form when a dialog opens
  useEffect(() => {
    const { type, user } = dialogState;
    if (type === 'user') {
      const isEditing = !!user;
      reset({
        email: user?.email || '',
        fullName: user?.fullName || '',
        role: user?.role || 'agent',
        fourDigitCode: user?.fourDigitCode || '',
        password: '',
        isActive: user ? user.isActive : true,
        permissions: user?.permissions || { canCreateOrders: true, canManageLeads: false },
        _isEditing: isEditing,
      });
    }
  }, [dialogState, reset]);

  const handleDialogClose = useCallback(() => {
    setDialogState({ type: null, user: null });
  }, []);

  const onSubmitUser = useCallback(async (data) => {
    clearMessages();
    const isEditing = !!dialogState.user;
    
    // NOTE: Ideally, the backend would handle user and permission updates in a single atomic transaction.
    try {
      const userData = {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        isActive: data.isActive,
      };

      if (data.role === 'agent' && data.fourDigitCode) {
        userData.fourDigitCode = data.fourDigitCode;
      }
      if (!isEditing && data.password) {
        userData.password = data.password;
      }
      
      const permissionsData = {
          permissions: {
            canCreateOrders: data.permissions.canCreateOrders,
            canManageLeads: data.role === 'lead_manager' || data.permissions.canManageLeads,
          }
      };

      if (isEditing) {
        await api.put(`/users/${dialogState.user._id}`, userData);
        await api.put(`/users/${dialogState.user._id}/permissions`, permissionsData);
        showSuccess('User updated successfully!');
      } else {
        await api.post('/users', { ...userData, ...permissionsData });
        showSuccess('User created successfully!');
      }
      
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save user.');
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handleDeleteUser = useCallback(async () => {
    clearMessages();
    try {
      await api.delete(`/users/${dialogState.user._id}`);
      showSuccess('User deactivated successfully!');
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate user.');
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handleApproveUser = useCallback(async (role) => {
    clearMessages();
    try {
      await api.put(`/users/${dialogState.user._id}/approve`, { role });
      showSuccess('User approved successfully!');
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve user.');
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handleAssignLeadManager = useCallback(async () => {
    clearMessages();
    try {
      await api.put(`/users/${dialogState.user._id}/assign-lead-manager`, { assignAsLeadManager: true });
      showSuccess('User assigned as lead manager successfully.');
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign lead manager.');
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handleApproveLeadManager = useCallback(async (approved, reason = '') => {
    clearMessages();
    try {
      await api.put(`/users/${dialogState.user._id}/approve-lead-manager`, { approved, reason });
      showSuccess(approved ? 'Lead manager approved.' : 'Lead manager rejected.');
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process lead manager approval.');
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handleChangePage = useCallback((_, newPage) => setPage(newPage), []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleFilterChange = useCallback((field) => (event) => {
    setFilters(prev => ({ ...prev, [field]: event.target.value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ role: '', isActive: '', status: '' });
    setPage(0);
  }, []);

  const canManageUsers = useMemo(() => currentUser?.role === 'admin', [currentUser]);

  if (!canManageUsers) {
    return (
      <Box p={3}>
        <Alert severity="error">You do not have permission to access this page.</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">User Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ type: 'user', user: null })}>
          Add User
        </Button>
      </Stack>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Filters</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4} md={3}><FormControl fullWidth><InputLabel>Role</InputLabel><Select value={filters.role} label="Role" onChange={handleFilterChange('role')}><MenuItem value="">All Roles</MenuItem>{Object.entries(ROLES).map(([key, { label }]) => (<MenuItem key={key} value={key}>{label}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12} sm={4} md={3}><FormControl fullWidth><InputLabel>Status</InputLabel><Select value={filters.status} label="Status" onChange={handleFilterChange('status')}><MenuItem value="">All Statuses</MenuItem>{Object.entries(STATUSES).map(([key, { label }]) => (<MenuItem key={key} value={key}>{label}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12} sm={4} md={3}><FormControl fullWidth><InputLabel>Activity</InputLabel><Select value={filters.isActive} label="Activity" onChange={handleFilterChange('isActive')}><MenuItem value="">All</MenuItem><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12} sm={12} md={3}><Button onClick={clearFilters} variant="outlined" fullWidth sx={{ height: '100%' }}>Clear Filters</Button></Grid>
          </Grid>
        </CardContent>
      </Card>
      
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell>
                <TableCell>Permissions</TableCell><TableCell>Agent Code</TableCell><TableCell>Activity</TableCell>
                <TableCell>Created</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>No users found.</TableCell></TableRow>
              ) : (
                users.map((user) => {
                  const roleInfo = ROLES[user.role] || ROLES.pending_approval;
                  const statusInfo = STATUSES[user.status] || STATUSES.pending;
                  return (
                    <TableRow key={user._id} hover>
                      <TableCell><Stack direction="row" alignItems="center" spacing={1.5}><Avatar sx={{ bgcolor: `${roleInfo.color}.lighter`, color: `${roleInfo.color}.dark` }}>{roleInfo.icon}</Avatar><Box><Typography variant="body2" fontWeight={500}>{user.fullName}</Typography><Typography variant="caption" color="text.secondary">{user.email}</Typography></Box></Stack></TableCell>
                      <TableCell><Chip label={roleInfo.label} color={roleInfo.color} size="small" /></TableCell>
                      <TableCell><Chip label={statusInfo.label} color={statusInfo.color} size="small" icon={statusInfo.icon} /></TableCell>
                      <TableCell><Stack direction="row" spacing={1}>{user.permissions?.canCreateOrders && <Chip label="Orders" size="small" variant="outlined" />}{user.permissions?.canManageLeads && <Chip label="Leads" size="small" variant="outlined" />}</Stack></TableCell>
                      <TableCell>{user.fourDigitCode ? <Chip label={user.fourDigitCode} variant="outlined" size="small" /> : '—'}</TableCell>
                      <TableCell><Chip label={user.isActive ? 'Active' : 'Inactive'} color={user.isActive ? 'success' : 'error'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {user.status === 'pending' && <Tooltip title="Approve User"><IconButton size="small" onClick={() => setDialogState({ type: 'approve', user })} color="success"><CheckCircleIcon /></IconButton></Tooltip>}
                          <Tooltip title="Edit User"><IconButton size="small" onClick={() => setDialogState({ type: 'user', user })}><EditIcon /></IconButton></Tooltip>
                          {user._id !== currentUser?.id && <Tooltip title="Deactivate User"><IconButton size="small" onClick={() => setDialogState({ type: 'delete', user })} color="error"><DeleteIcon /></IconButton></Tooltip>}
                          {user.role !== 'admin' && user.leadManagerStatus === 'not_applicable' && <Tooltip title="Assign as Lead Manager"><IconButton size="small" onClick={() => setDialogState({ type: 'assignLeadManager', user })} color="secondary"><LeadManagerIcon /></IconButton></Tooltip>}
                          {user.leadManagerStatus === 'pending' && <Tooltip title="Approve Lead Manager Request"><IconButton size="small" onClick={() => setDialogState({ type: 'approveLeadManager', user })} color="warning"><CheckCircleIcon /></IconButton></Tooltip>}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination rowsPerPageOptions={[5, 10, 25]} component="div" count={totalUsers} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
      </Paper>
      
      {/* --- Dialogs --- */}
      <UserDialog open={dialogState.type === 'user'} onClose={handleDialogClose} onSubmit={handleSubmit(onSubmitUser)} isEditing={!!dialogState.user} control={control} errors={errors} isSubmitting={isSubmitting} watchedRole={watchedRole}/>
      
      <Dialog open={dialogState.type === 'delete'} onClose={handleDialogClose} maxWidth="xs"><DialogTitle>Confirm Deactivation</DialogTitle><DialogContent><Typography>Are you sure you want to deactivate "{dialogState.user?.fullName}"?</Typography></DialogContent><DialogActions><Button onClick={handleDialogClose}>Cancel</Button><Button onClick={handleDeleteUser} color="error" variant="contained">Deactivate</Button></DialogActions></Dialog>
      <Dialog open={dialogState.type === 'approve'} onClose={handleDialogClose} maxWidth="xs"><DialogTitle>Approve User</DialogTitle><DialogContent><Typography>Approve "{dialogState.user?.fullName}" and assign a role:</Typography><Stack spacing={1} sx={{ mt: 2 }}>{Object.entries(ROLES).filter(([key]) => !['pending_approval'].includes(key)).map(([key, { label, icon }]) => (<Button key={key} variant="outlined" onClick={() => handleApproveUser(key)} startIcon={icon}>{label}</Button>))}</Stack></DialogContent><DialogActions><Button onClick={handleDialogClose}>Cancel</Button></DialogActions></Dialog>
      <Dialog open={dialogState.type === 'assignLeadManager'} onClose={handleDialogClose} maxWidth="xs"><DialogTitle>Assign Lead Manager</DialogTitle><DialogContent><Typography>Assign "{dialogState.user?.fullName}" to be a Lead Manager? This will require admin approval.</Typography></DialogContent><DialogActions><Button onClick={handleDialogClose}>Cancel</Button><Button onClick={handleAssignLeadManager} color="secondary" variant="contained">Assign</Button></DialogActions></Dialog>
      <Dialog open={dialogState.type === 'approveLeadManager'} onClose={handleDialogClose} maxWidth="xs"><DialogTitle>Approve Lead Manager</DialogTitle><DialogContent><Typography>Approve or reject "{dialogState.user?.fullName}"'s request to be a Lead Manager.</Typography></DialogContent><DialogActions><Button onClick={handleDialogClose}>Cancel</Button><Button onClick={() => handleApproveLeadManager(false, 'Rejected by admin')} color="error">Reject</Button><Button onClick={() => handleApproveLeadManager(true)} color="success" variant="contained">Approve</Button></DialogActions></Dialog>
    </Box>
  );
};

export default UsersPage;