import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
    Container,
    Paper,
    Typography,
    Box,
    TextField,
    Button,
    Alert,
    CircularProgress,
    InputAdornment,
    Link,
} from '@mui/material';
import {
    Person as PersonIcon,
    Email as EmailIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { register, clearError, selectAuth } from '../store/slices/authSlice';

// Validation schema for the registration form
const schema = yup.object({
    fullName: yup.string().required('Full name is required').min(2, 'Name must be at least 2 characters'),
    email: yup.string().email('Invalid email format').required('Email is required'),
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
    confirmPassword: yup.string().oneOf([yup.ref('password'), null], 'Passwords must match').required('Please confirm your password')
});

const RegisterPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isLoading, error } = useSelector(selectAuth);
    const [successMessage, setSuccessMessage] = useState('');

    // Clear previous errors when the component mounts
    useEffect(() => {
        dispatch(clearError());
    }, [dispatch]);

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            confirmPassword: ''
        }
    });

    const onSubmit = async (data) => {
        // Clear previous messages
        // Променихме 'setError(null);' на 'dispatch(clearError());'
        dispatch(clearError()); // Използваме dispatch за изчистване на състоянието за грешка от Redux
        setSuccessMessage('');

        try {
            const actionResult = await dispatch(register({
                fullName: data.fullName,
                email: data.email,
                password: data.password
            })).unwrap();

            // On success, show a confirmation message
            setSuccessMessage(actionResult.message || 'Registration successful. Your account is pending approval.');

        } catch (err) {
            // Error is handled by Redux state, but we log it for debugging
            console.error('Registration failed:', err);
        }
    };

    return (
        <Container component="main" maxWidth="sm">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Typography component="h1" variant="h4" align="center" gutterBottom>
                            Create an Account
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        {successMessage && !error && (
                            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                                {successMessage}
                            </Alert>
                        )}

                        <Box
                            component="form"
                            onSubmit={handleSubmit(onSubmit)}
                            sx={{ mt: 1, width: '100%' }}
                        >
                            <Controller
                                name="fullName"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        margin="normal"
                                        required
                                        fullWidth
                                        label="Full Name"
                                        autoComplete="name"
                                        autoFocus
                                        error={!!errors.fullName}
                                        helperText={errors.fullName?.message}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start"><PersonIcon /></InputAdornment>
                                            ),
                                        }}
                                    />
                                )}
                            />
                            <Controller
                                name="email"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        margin="normal"
                                        required
                                        fullWidth
                                        label="Email Address"
                                        autoComplete="email"
                                        error={!!errors.email}
                                        helperText={errors.email?.message}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start"><EmailIcon /></InputAdornment>
                                            ),
                                        }}
                                    />
                                )}
                            />
                            <Controller
                                name="password"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        margin="normal"
                                        required
                                        fullWidth
                                        label="Password"
                                        type="password"
                                        autoComplete="new-password"
                                        error={!!errors.password}
                                        helperText={errors.password?.message}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start"><LockIcon /></InputAdornment>
                                            ),
                                        }}
                                    />
                                )}
                            />
                            <Controller
                                name="confirmPassword"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        margin="normal"
                                        required
                                        fullWidth
                                        label="Confirm Password"
                                        type="password"
                                        autoComplete="new-password"
                                        error={!!errors.confirmPassword}
                                        helperText={errors.confirmPassword?.message}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start"><LockIcon /></InputAdornment>
                                            ),
                                        }}
                                    />
                                )}
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }}
                                disabled={isLoading}
                                size="large"
                            >
                                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
                            </Button>

                            <Box sx={{ mt: 2, textAlign: 'center' }}>
                                <Link component={RouterLink} to="/login" variant="body2">
                                    {"Already have an account? Sign In"}
                                </Link>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default RegisterPage;