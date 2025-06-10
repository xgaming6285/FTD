import React, { useState } from 'react';
import {
    Box,
    Button,
    TextField,
    Grid,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Typography,
    Paper,
    Alert,
    CircularProgress
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';

// Validation schema for adding a lead
const addLeadSchema = yup.object({
    firstName: yup.string().required('First name is required').min(2, 'First name must be at least 2 characters'),
    lastName: yup.string().required('Last name is required').min(2, 'Last name must be at least 2 characters'),
    email: yup.string().required('Email is required').email('Invalid email format'),
    phone: yup.string().nullable(),
    country: yup.string().required('Country is required').min(2, 'Country must be at least 2 characters'),
    leadType: yup.string().required('Lead type is required').oneOf(['ftd', 'filler', 'cold', 'live'], 'Invalid lead type'),
    sin: yup.string().when('leadType', {
        is: 'ftd',
        then: () => yup.string().required('SIN is required for FTD leads'),
        otherwise: () => yup.string().nullable()
    })
});

const AddLeadForm = ({ onLeadAdded }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors }
    } = useForm({
        resolver: yupResolver(addLeadSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            country: '',
            leadType: '',
            sin: '',
            client: '',
            clientBroker: '',
            clientNetwork: ''
        }
    });

    const leadType = watch('leadType');

    const onSubmit = async (data) => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await api.post('/leads', data);

            if (response.data.success) {
                setSuccess('Lead added successfully');
                reset(); // Reset form after successful submission
                if (onLeadAdded) {
                    onLeadAdded(response.data.data);
                }
            } else {
                throw new Error(response.data.message || 'Failed to add lead');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to add lead');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
                Add New Lead
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Controller
                            name="firstName"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="First Name"
                                    fullWidth
                                    error={!!errors.firstName}
                                    helperText={errors.firstName?.message}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="lastName"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Last Name"
                                    fullWidth
                                    error={!!errors.lastName}
                                    helperText={errors.lastName?.message}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Email"
                                    fullWidth
                                    error={!!errors.email}
                                    helperText={errors.email?.message}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Phone"
                                    fullWidth
                                    error={!!errors.phone}
                                    helperText={errors.phone?.message}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="country"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Country"
                                    fullWidth
                                    error={!!errors.country}
                                    helperText={errors.country?.message}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth error={!!errors.leadType}>
                            <InputLabel>Lead Type</InputLabel>
                            <Controller
                                name="leadType"
                                control={control}
                                render={({ field }) => (
                                    <Select {...field} label="Lead Type">
                                        <MenuItem value="ftd">FTD</MenuItem>
                                        <MenuItem value="filler">Filler</MenuItem>
                                        <MenuItem value="cold">Cold</MenuItem>
                                        <MenuItem value="live">Live</MenuItem>
                                    </Select>
                                )}
                            />
                            {errors.leadType && (
                                <Typography color="error" variant="caption">
                                    {errors.leadType.message}
                                </Typography>
                            )}
                        </FormControl>
                    </Grid>

                    {leadType === 'ftd' && (
                        <Grid item xs={12} md={6}>
                            <Controller
                                name="sin"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="SIN"
                                        fullWidth
                                        error={!!errors.sin}
                                        helperText={errors.sin?.message}
                                    />
                                )}
                            />
                        </Grid>
                    )}

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="client"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Client"
                                    fullWidth
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="clientBroker"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Client Broker"
                                    fullWidth
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Controller
                            name="clientNetwork"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Client Network"
                                    fullWidth
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={loading}
                            sx={{ mr: 2 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Add Lead'}
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => reset()}
                            disabled={loading}
                        >
                            Reset
                        </Button>
                    </Grid>
                </Grid>
            </Box>
        </Paper>
    );
};

export default AddLeadForm;