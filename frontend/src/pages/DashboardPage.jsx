import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  LinearProgress,
  Avatar,
  Stack,
  Divider,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

const DashboardPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    overview: {},
    recentActivity: [],
    performance: {},
    leadsStats: {},
    usersStats: {},
    ordersStats: {},
  });

  useEffect(() => {
    fetchDashboardData();
  }, [user?.role]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Ensure user object is loaded before making calls
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      const promises = [];

      // Based on role, fetch relevant data
      if (user.role === 'admin') {
        promises.push(
          api.get('/leads/stats'),
          api.get('/users/stats'),
          api.get('/orders?limit=5'),
          api.get('/users/top-performers'),
          api.get('/users/team-stats')
        );
      } else if (user.role === 'affiliate_manager') {
        promises.push(
          api.get('/orders?limit=10'),
          api.get('/leads?isAssigned=true'),
          api.get('/orders/stats')
        );
      } else if (user.role === 'agent') {
        promises.push(
          api.get('/leads/assigned'),
          api.get(`/users/${user.id}/performance`)
        );
      }

      const responses = await Promise.allSettled(promises);

      const firstRejected = responses.find(res => res.status === 'rejected');
      if (firstRejected) {
        throw new Error(firstRejected.reason.response?.data?.message || 'Failed to fetch some dashboard data');
      }

      // Process responses based on role
      const data = {
        overview: {},
        recentActivity: [],
        performance: {},
        leadsStats: {},
        usersStats: {},
        ordersStats: {},
      };

      if (user.role === 'admin') {
        data.leadsStats = responses[0].value.data.data;
        data.usersStats = responses[1].value.data.data;
        data.recentActivity = responses[2].value.data.data || [];
        data.performance = responses[3].value.data.data;
        data.overview = responses[4].value.data.data;
      } else if (user.role === 'affiliate_manager') {
        data.recentActivity = responses[0].value.data.data || [];
        data.leadsStats = { assigned: responses[1].value.data.data.length };
        data.ordersStats = responses[2].value.data.data;
      } else if (user.role === 'agent') {
        data.leadsStats = { assigned: responses[0].value.data.data.length };
        data.recentActivity = responses[0].value.data.data.slice(0, 5) || [];
        data.performance = responses[1].value.data.data.data;
      }

      setDashboardData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': case 'contacted': case 'completed': return 'success';
      case 'pending': case 'new': return 'warning';
      case 'cancelled': case 'not_interested': return 'error';
      default: return 'default';
    }
  };

  // Enhanced card styles
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

  const avatarStyle = {
    background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    boxShadow: '0 4px 12px 0 rgba(31, 38, 135, 0.15)',
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
      {/* Welcome Header */}
      <motion.div variants={itemVariants}>
        <Typography variant="h4" gutterBottom sx={{
          background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 4,
          fontWeight: 'bold'
        }}>
          {`${getGreeting()}, ${user?.firstName || 'User'}!`}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to your dashboard. Here's what's happening today.
        </Typography>
      </motion.div>

      <Grid container spacing={3}>
        {/* Role-based Overview Cards */}
        {user?.role === 'admin' && (
          <>
            {/* Admin Overview Cards */}
            <Grid item xs={12} sm={6} md={3} component={motion.div} variants={itemVariants}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ ...avatarStyle, mr: 2 }}>
                      <PeopleIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 'bold',
                        background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>
                        {dashboardData.usersStats.total || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Users
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3} component={motion.div} variants={itemVariants}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ ...avatarStyle, mr: 2, background: (theme) => `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})` }}>
                      <AssignmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 'bold',
                        background: (theme) => `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>
                        {dashboardData.leadsStats.total || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Leads
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3} component={motion.div} variants={itemVariants}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ ...avatarStyle, mr: 2 }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {dashboardData.overview.totalCalls || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Calls Today
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3} component={motion.div} variants={itemVariants}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ ...avatarStyle, mr: 2 }}>
                      <CheckCircleIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {dashboardData.overview.activeAgents || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Agents
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Performers */}
            <Grid item xs={12} md={6} component={motion.div} variants={itemVariants}>
              <Card sx={cardStyle}>
                <CardHeader title="Top Performers Today" />
                <CardContent>
                  {dashboardData.performance.length > 0 ? (
                    <List>
                      {dashboardData.performance.slice(0, 5).map((performer, index) => (
                        <ListItem
                          key={performer._id}
                          divider={index < 4}
                          component={motion.div}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          sx={{
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.05),
                            }
                          }}
                        >
                          <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                            {index + 1}
                          </Avatar>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                                {performer.fullName}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="success.main">
                                {performer.totalCalls} calls • $${performer.totalEarnings}
                              </Typography>
                            }
                          />
                          <Typography variant="body2" color="success.main">
                            {performer.successRate}% success
                          </Typography>
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No performance data available for today.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Agent/Affiliate Manager Overview */}
        {(user?.role === 'agent' || user?.role === 'affiliate_manager') && (
          <>
            <Grid item xs={12} sm={6} md={4} component={motion.div} variants={itemVariants}>
              <Card sx={cardStyle}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ ...avatarStyle, mr: 2 }}>
                      <AssignmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {dashboardData.leadsStats.assigned || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Assigned Leads
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {user?.role === 'agent' && dashboardData.performance && (
              <>
                <Grid item xs={12} sm={6} md={4} component={motion.div} variants={itemVariants}>
                  <Card sx={cardStyle}>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ ...avatarStyle, mr: 2 }}>
                          <PhoneIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                            {dashboardData.performance.totalCalls || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Calls Today
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4} component={motion.div} variants={itemVariants}>
                  <Card sx={cardStyle}>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ ...avatarStyle, mr: 2 }}>
                          <MoneyIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                            ${dashboardData.performance.totalEarnings || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Earnings Today
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Performance Progress */}
                <Grid item xs={12} component={motion.div} variants={itemVariants}>
                  <Card sx={cardStyle}>
                    <CardHeader title="Today's Performance" />
                    <CardContent>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" gutterBottom>
                            Call Success Rate
                          </Typography>
                          <Box display="flex" alignItems="center">
                            <LinearProgress
                              variant="determinate"
                              value={dashboardData.performance.successRate || 0}
                              sx={{ flexGrow: 1, mr: 2, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2">
                              {dashboardData.performance.successRate || 0}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" gutterBottom>
                            Daily Goal Progress
                          </Typography>
                          <Box display="flex" alignItems="center">
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((dashboardData.performance.totalCalls || 0) / 50 * 100, 100)}
                              sx={{ flexGrow: 1, mr: 2, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2">
                              {dashboardData.performance.totalCalls || 0}/50
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </>
        )}

        {/* Recent Activity */}
        <Grid item xs={12} md={6} component={motion.div} variants={itemVariants}>
          <Card sx={cardStyle}>
            <CardHeader 
              title={
                <Typography variant="h6" sx={{ 
                  fontWeight: 'bold',
                  color: theme.palette.primary.main
                }}>
                  {user?.role === 'agent' ? 'Recent Assigned Leads' :
                    user?.role === 'affiliate_manager' ? 'Recent Orders' :
                      'Recent Orders'}
                </Typography>
              }
            />
            <CardContent>
              {dashboardData.recentActivity.length > 0 ? (
                <List>
                  {dashboardData.recentActivity.map((item, index) => (
                    <ListItem
                      key={item._id}
                      divider={index < dashboardData.recentActivity.length - 1}
                      component={motion.div}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      sx={{
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                            {user?.role === 'agent'
                              ? `${item.firstName} ${item.lastName}`
                              : `Order #${item._id.slice(-6)}`}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {user?.role === 'agent'
                              ? `${item.leadType} • ${item.email}`
                              : `${item.requests?.ftd || 0} FTD, ${item.requests?.filler || 0} Filler, ${item.requests?.cold || 0} Cold`}
                          </Typography>
                        }
                      />
                      <Chip
                        label={item.status}
                        color={getStatusColor(item.status)}
                        size="small"
                        sx={{
                          fontWeight: 'medium',
                          boxShadow: `0 2px 8px 0 ${alpha(theme.palette[getStatusColor(item.status)].main, 0.2)}`,
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box textAlign="center" py={4}>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 100 }}
                  >
                    <ScheduleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      No recent activity to display.
                    </Typography>
                  </motion.div>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        {user?.role === 'admin' && (
          <Grid item xs={12} md={6} component={motion.div} variants={itemVariants}>
            <Card sx={cardStyle}>
              <CardHeader 
                title={
                  <Typography variant="h6" sx={{ 
                    fontWeight: 'bold',
                    color: theme.palette.primary.main
                  }}>
                    System Overview
                  </Typography>
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Available Leads</Typography>
                    <Typography variant="h6" sx={{
                      color: theme.palette.success.main,
                      fontWeight: 'bold'
                    }}>
                      {dashboardData.leadsStats.available || 0}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Assigned Leads</Typography>
                    <Typography variant="h6" sx={{
                      color: theme.palette.info.main,
                      fontWeight: 'bold'
                    }}>
                      {dashboardData.leadsStats.assigned || 0}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Pending Orders</Typography>
                    <Typography variant="h6" sx={{
                      color: theme.palette.warning.main,
                      fontWeight: 'bold'
                    }}>
                      {dashboardData.recentActivity.filter(order => order.status === 'pending').length}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Active Agents</Typography>
                    <Typography variant="h6" sx={{
                      color: theme.palette.primary.main,
                      fontWeight: 'bold'
                    }}>
                      {dashboardData.usersStats.activeAgents || 0}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default DashboardPage; 