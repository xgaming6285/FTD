import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useSelector(selectAuth);
  const location = useLocation();

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (isAuthenticated) {
    // Redirect to the page they came from, or dashboard as fallback
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return children;
};

export default PublicRoute; 