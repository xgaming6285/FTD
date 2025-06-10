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
  Divider,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  ManageAccounts as ManagerIcon,
  Support as AgentIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { selectUser } from '../store/slices/authSlice';

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
  const theme = useTheme();
  const currentUser = useSelector(selectUser);
  const [showFilters, setShowFilters] = useState(false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filters, setFilters] = useState({
    role: '',
    isActive: '',
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
    <Box component={motion.div} 
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom sx={{
          background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          User Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateUser}
          sx={{
            background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            boxShadow: '0 4px 12px 0 rgba(31, 38, 135, 0.15)',
            '&:hover': {
              background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
              boxShadow: '0 6px 16px 0 rgba(31, 38, 135, 0.25)',
            }
          }}
        >
          Add User
        </Button>
      </Box>

      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
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

      {/* Filters Card */}
      <Card sx={{ ...cardStyle, mb: 2 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
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
              <FilterIcon />
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
                  <Grid item xs={12} sm={6} md={4}>
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
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filters.isActive}
                        label="Status"
                        onChange={handleFilterChange('isActive')}
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="true">Active</MenuItem>
                        <MenuItem value="false">Inactive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Button 
                      onClick={clearFilters} 
                      variant="outlined"
                      fullWidth
                      sx={{
                        height: '100%',
                        borderColor: theme.palette.primary.main,
                        color: theme.palette.primary.main,
                        '&:hover': {
                          borderColor: theme.palette.primary.dark,
                          backgroundColor: 'rgba(25, 118, 210, 0.04)'
                        }
                      }}
                    >
                      Clear Filters
                    </Button>
                  </Grid>
                </Grid>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Users Table with Animation */}
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
            <Paper sx={{ ...cardStyle }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Agent Code</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Permissions</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Box py={3}>
                            <Typography variant="body1" color="text.secondary">
                              No users found
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow 
                          key={user._id}
                          sx={tableRowStyle}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar 
                                sx={{ 
                                  bgcolor: (theme) => {
                                    const color = getRoleColor(user.role);
                                    return theme.palette[color]?.light || theme.palette.grey.light;
                                  },
                                  color: (theme) => {
                                    const color = getRoleColor(user.role);
                                    return theme.palette[color]?.main || theme.palette.grey.main;
                                  }
                                }}
                              >
                                {user.fullName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {user.fullName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {user._id.slice(-8)}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getRoleIcon(user.role)}
                              label={user.role.replace('_', ' ').toUpperCase()}
                              sx={{
                                background: (theme) => `linear-gradient(45deg, ${theme.palette[getRoleColor(user.role)].light}, ${theme.palette[getRoleColor(user.role)].main})`,
                                color: 'white',
                                fontWeight: 'bold'
                              }}
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
                                sx={{ 
                                  borderColor: theme.palette.primary.main,
                                  color: theme.palette.primary.main
                                }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.isActive ? 'Active' : 'Inactive'}
                              sx={{
                                background: (theme) => `linear-gradient(45deg, ${
                                  user.isActive 
                                    ? `${theme.palette.success.light}, ${theme.palette.success.main}`
                                    : `${theme.palette.error.light}, ${theme.palette.error.main}`
                                })`,
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              {user.permissions?.canCreateOrders && (
                                <Chip
                                  label="Create Orders"
                                  size="small"
                                  sx={{
                                    background: (theme) => `linear-gradient(45deg, ${theme.palette.info.light}, ${theme.palette.info.main})`,
                                    color: 'white',
                                    fontWeight: 'bold'
                                  }}
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Edit User">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditUser(user)}
                                  sx={{
                                    '&:hover': {
                                      color: theme.palette.primary.main,
                                      backgroundColor: 'rgba(25, 118, 210, 0.04)'
                                    }
                                  }}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              {user._id !== currentUser.id && (
                                <Tooltip title="Deactivate User">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteDialog(user)}
                                    sx={{
                                      '&:hover': {
                                        color: theme.palette.error.main,
                                        backgroundColor: 'rgba(211, 47, 47, 0.04)'
                                      }
                                    }}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit User Dialog */}
      <Dialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            ...cardStyle,
            mt: 2
          }
        }}
      >
        <DialogTitle sx={{
          background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          {isEditing ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <Divider />
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
                          color="primary"
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
                          color="primary"
                        />
                      }
                      label="Can Create Orders"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: 'background.default' }}>
            <Button 
              onClick={() => setUserDialogOpen(false)}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{
                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                '&:hover': {
                  background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`
                }
              }}
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
        PaperProps={{
          sx: {
            ...cardStyle,
            mt: 2
          }
        }}
      >
        <DialogTitle sx={{
          color: theme.palette.error.main,
          fontWeight: 'bold'
        }}>
          Confirm Deactivation
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate user "{selectedUser?.fullName}"?
            This action will disable their access to the system.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'background.default' }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            variant="contained"
            sx={{
              background: (theme) => `linear-gradient(45deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
              '&:hover': {
                background: (theme) => `linear-gradient(45deg, ${theme.palette.error.dark}, ${theme.palette.error.main})`
              }
            }}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;