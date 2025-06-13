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
import { getSortedCountries } from '../constants/countries';

// Validation schema for adding a lead
const addLeadSchema = yup.object({
    firstName: yup.string().required('First name is required').min(2, 'First name must be at least 2 characters'),
    lastName: yup.string().required('Last name is required').min(2, 'Last name must be at least 2 characters'),
    gender: yup.string().oneOf(['male', 'female', 'not_defined'], 'Invalid gender').default('not_defined'),
    newEmail: yup.string().required('New email is required').email('Invalid email format'),
    oldEmail: yup.string().nullable().email('Invalid email format'),
    newPhone: yup.string().required('New phone is required'),
    oldPhone: yup.string().nullable(),
    country: yup.string().required('Country is required').min(2, 'Country must be at least 2 characters'),
    leadType: yup.string().required('Lead type is required').oneOf(['ftd', 'filler', 'cold', 'live'], 'Invalid lead type'),
    sin: yup.string().when('leadType', {
        is: 'ftd',
        then: () => yup.string().required('SIN is required for FTD leads'),
        otherwise: () => yup.string().nullable()
    }),
    dob: yup.date().nullable().when('leadType', {
        is: (val) => val === 'ftd' || val === 'filler',
        then: () => yup.date().nullable(),
        otherwise: () => yup.date().nullable()
    }),
    address: yup.string().nullable(),
    'socialMedia.facebook': yup.string().nullable().url('Invalid Facebook URL'),
    'socialMedia.twitter': yup.string().nullable().url('Invalid Twitter URL'),
    'socialMedia.linkedin': yup.string().nullable().url('Invalid LinkedIn URL'),
    'socialMedia.instagram': yup.string().nullable().url('Invalid Instagram URL'),
    'socialMedia.telegram': yup.string().nullable(),
    'socialMedia.whatsapp': yup.string().nullable()
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
            gender: 'not_defined',
            newEmail: '',
            oldEmail: '',
            newPhone: '',
            oldPhone: '',
            country: '',
            leadType: '',
            sin: '',
            client: '',
            clientBroker: '',
            clientNetwork: '',
            dob: null,
            address: {
                street: '',
                city: '',
                postalCode: ''
            },
            socialMedia: {
                facebook: '',
                twitter: '',
                linkedin: '',
                instagram: '',
                telegram: '',
                whatsapp: ''
            }
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

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Grid container spacing={2}>
                    {/* Basic Information */}
                    <Grid item xs={12} sm={6}>
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
                    <Grid item xs={12} sm={6}>
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

                    {/* Lead Type and Gender */}
                    <Grid item xs={12} sm={6}>
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
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth error={!!errors.gender}>
                            <InputLabel>Gender</InputLabel>
                            <Controller
                                name="gender"
                                control={control}
                                render={({ field }) => (
                                    <Select {...field} label="Gender">
                                        <MenuItem value="male">Male</MenuItem>
                                        <MenuItem value="female">Female</MenuItem>
                                        <MenuItem value="not_defined">Not Defined</MenuItem>
                                    </Select>
                                )}
                            />
                            {errors.gender && (
                                <Typography variant="caption" color="error">
                                    {errors.gender.message}
                                </Typography>
                            )}
                        </FormControl>
                    </Grid>

                    {/* Contact Information */}
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="newEmail"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="New Email"
                                    fullWidth
                                    error={!!errors.newEmail}
                                    helperText={errors.newEmail?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="oldEmail"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Old Email (Optional)"
                                    fullWidth
                                    error={!!errors.oldEmail}
                                    helperText={errors.oldEmail?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="newPhone"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="New Phone"
                                    fullWidth
                                    error={!!errors.newPhone}
                                    helperText={errors.newPhone?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="oldPhone"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Old Phone (Optional)"
                                    fullWidth
                                    error={!!errors.oldPhone}
                                    helperText={errors.oldPhone?.message}
                                />
                            )}
                        />
                    </Grid>

                    {/* Location and Client Information */}
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="country"
                            control={control}
                            render={({ field }) => (
                                <FormControl fullWidth error={!!errors.country}>
                                    <InputLabel>Country</InputLabel>
                                    <Select
                                        {...field}
                                        label="Country"
                                        value={field.value || ''}
                                    >
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
                                </FormControl>
                            )}
                        />
                    </Grid>

                    {/* Client Information */}
                    <Grid item xs={12} sm={6}>
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
                    <Grid item xs={12} sm={6}>
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
                    <Grid item xs={12} sm={6}>
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

                    {/* FTD Specific Fields */}
                    {leadType === 'ftd' && (
                        <Grid item xs={12} sm={6}>
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

                    {/* FTD & Filler Specific Fields */}
                    {(leadType === 'ftd' || leadType === 'filler') && (
                        <>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="dob"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Date of Birth"
                                            type="date"
                                            fullWidth
                                            InputLabelProps={{
                                                shrink: true,
                                            }}
                                            error={!!errors.dob}
                                            helperText={errors.dob?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="address"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Address"
                                            fullWidth
                                            multiline
                                            rows={3}
                                            error={!!errors.address}
                                            helperText={errors.address?.message}
                                        />
                                    )}
                                />
                            </Grid>
                        </>
                    )}

                    {/* Social Media Fields */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle1" gutterBottom>
                            Social Media (Optional)
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.facebook"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Facebook"
                                    fullWidth
                                    error={!!errors['socialMedia.facebook']}
                                    helperText={errors['socialMedia.facebook']?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.twitter"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Twitter"
                                    fullWidth
                                    error={!!errors['socialMedia.twitter']}
                                    helperText={errors['socialMedia.twitter']?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.linkedin"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="LinkedIn"
                                    fullWidth
                                    error={!!errors['socialMedia.linkedin']}
                                    helperText={errors['socialMedia.linkedin']?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.instagram"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Instagram"
                                    fullWidth
                                    error={!!errors['socialMedia.instagram']}
                                    helperText={errors['socialMedia.instagram']?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.telegram"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Telegram"
                                    fullWidth
                                    error={!!errors['socialMedia.telegram']}
                                    helperText={errors['socialMedia.telegram']?.message}
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.whatsapp"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="WhatsApp"
                                    fullWidth
                                    error={!!errors['socialMedia.whatsapp']}
                                    helperText={errors['socialMedia.whatsapp']?.message}
                                />
                            )}
                        />
                    </Grid>

                    {/* Form Actions */}
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