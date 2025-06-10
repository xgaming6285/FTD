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
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingIcon,
  PersonAdd as PersonAddIcon,
  AssignmentTurnedIn as AssignedIcon,
  AssignmentReturn as UnassignedIcon,
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';

const DashboardPage = () => {
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
        data.performance = responses[1].value.data.data;
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
    <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh', p: 3 }}>
      {/* Welcome Header */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          {getGreeting()}, {user?.fullName || user?.email}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to your dashboard. Here's what's happening today.
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        {/* Role-based Overview Cards */}
        {user?.role === 'admin' && (
          <>
            {/* Admin Overview Cards */}
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 48, height: 48 }}>
                      <PeopleIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
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

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ bgcolor: 'success.main', mr: 2, width: 48, height: 48 }}>
                      <AssignmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {dashboardData.leadsStats?.leads?.overall?.total || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Leads
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dashboardData.leadsStats?.leads?.overall?.assigned || 0} assigned
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ bgcolor: 'info.main', mr: 2, width: 48, height: 48 }}>
                      <PersonAddIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {dashboardData.usersStats.activeAgents || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Agents
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ bgcolor: 'warning.main', mr: 2, width: 48, height: 48 }}>
                      <UnassignedIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {dashboardData.leadsStats?.leads?.overall?.available || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Available Leads
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Lead Type Breakdown */}
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardHeader 
                  title="Lead Distribution by Type"
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                  <Grid container spacing={3}>
                    {dashboardData.leadsStats?.leads && Object.entries(dashboardData.leadsStats.leads).map(([type, stats]) => {
                      if (type === 'overall') return null;
                      return (
                        <Grid item xs={12} sm={6} md={3} key={type}>
                          <Paper 
                            elevation={1} 
                            sx={{ 
                              p: 2, 
                              textAlign: 'center',
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'grey.200'
                            }}
                          >
                            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                              {stats.total || 0}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ mb: 2, textTransform: 'uppercase', fontWeight: 500 }}>
                              {type} Leads
                            </Typography>
                            <Box display="flex" justifyContent="space-between">
                              <Box textAlign="center">
                                <Typography variant="body2" color="text.secondary">Assigned</Typography>
                                <Typography variant="h6" color="success.main">{stats.assigned || 0}</Typography>
                              </Box>
                              <Box textAlign="center">
                                <Typography variant="body2" color="text.secondary">Available</Typography>
                                <Typography variant="h6" color="warning.main">{stats.available || 0}</Typography>
                              </Box>
                            </Box>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Performers */}
            <Grid item xs={12} md={6}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardHeader 
                  title="Top Performers Today" 
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                  {dashboardData.performance?.length > 0 ? (
                    <List>
                      {dashboardData.performance.slice(0, 5).map((performer, index) => (
                        <ListItem 
                          key={performer._id} 
                          divider={index < 4}
                          sx={{ px: 0 }}
                        >
                          <Avatar sx={{ mr: 2, bgcolor: 'grey.300', color: 'text.primary' }}>
                            {index + 1}
                          </Avatar>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                {performer.fullName}
                              </Typography>
                            }
                            secondary={`${performer.totalCalls} calls • $${performer.totalEarnings}`}
                          />
                          <Chip
                            label={`${performer.successRate}% success`}
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Box textAlign="center" py={4}>
                      <TrendingUpIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        No performance data available for today.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* System Overview */}
            <Grid item xs={12} md={6}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardHeader 
                  title="System Overview" 
                  titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                  <Stack spacing={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center">
                        <AssignedIcon sx={{ mr: 1, color: 'success.main' }} />
                        <Typography variant="body1">Assigned Leads</Typography>
                      </Box>
                      <Typography variant="h6" color="success.main">
                        {dashboardData.leadsStats?.leads?.overall?.assigned || 0}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center">
                        <UnassignedIcon sx={{ mr: 1, color: 'warning.main' }} />
                        <Typography variant="body1">Available Leads</Typography>
                      </Box>
                      <Typography variant="h6" color="warning.main">
                        {dashboardData.leadsStats?.leads?.overall?.available || 0}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center">
                        <PendingIcon sx={{ mr: 1, color: 'info.main' }} />
                        <Typography variant="body1">Pending Orders</Typography>
                      </Box>
                      <Typography variant="h6" color="info.main">
                        {dashboardData.recentActivity.filter(order => order.status === 'pending').length}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center">
                        <CheckCircleIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body1">Active Agents</Typography>
                      </Box>
                      <Typography variant="h6" color="primary.main">
                        {dashboardData.usersStats.activeAgents || 0}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Agent/Affiliate Manager Overview */}
        {(user?.role === 'agent' || user?.role === 'affiliate_manager') && (
          <>
            <Grid item xs={12} sm={6} md={4}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      <AssignmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4">
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
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                          <PhoneIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h4">
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

                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                          <MoneyIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h4">
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
                <Grid item xs={12}>
                  <Card>
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
                              value={dashboardData.performance.goalProgress || 0}
                              sx={{ flexGrow: 1, mr: 2, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2">
                              {dashboardData.performance.goalProgress || 0}%
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
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title={
                user?.role === 'agent' ? 'Recent Assigned Leads' :
                  user?.role === 'affiliate_manager' ? 'Recent Orders' :
                    'Recent Orders'
              }
            />
            <CardContent>
              {dashboardData.recentActivity.length > 0 ? (
                <List>
                  {dashboardData.recentActivity.map((item, index) => (
                    <ListItem key={item._id} divider={index < dashboardData.recentActivity.length - 1}>
                      <ListItemText
                        primary={
                          user?.role === 'agent'
                            ? `${item.firstName} ${item.lastName}`
                            : `Order #${item._id.slice(-6)}`
                        }
                        secondary={
                          user?.role === 'agent'
                            ? `${item.leadType} • ${item.email}`
                            : `${item.requests?.ftd || 0} FTD, ${item.requests?.filler || 0} Filler, ${item.requests?.cold || 0} Cold, ${item.requests?.live || 0} Live`
                        }
                      />
                      <Chip
                        label={item.status}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box textAlign="center" py={4}>
                  <ScheduleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No recent activity to display.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage; 