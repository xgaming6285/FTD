import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  CircularProgress,
} from "@mui/material";
import api from "../services/api";

const LEAD_STATUSES = {
  ACTIVE: "active",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  INACTIVE: "inactive",
};

const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
  LIVE: "live",
};

const schema = yup.object().shape({
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  newEmail: yup.string().email("Invalid email").required("Email is required"),
  oldEmail: yup.string().nullable().email("Invalid email format"),
  newPhone: yup.string().required("Phone number is required"),
  oldPhone: yup.string().nullable(),
  country: yup.string().required("Country is required"),
  status: yup.string().oneOf(Object.values(LEAD_STATUSES), "Invalid status"),
  leadType: yup.string().oneOf(Object.values(LEAD_TYPES), "Invalid lead type"),
  sin: yup.string().when("leadType", {
    is: "ftd",
    then: (schema) => schema.required("SIN is required for FTD leads"),
    otherwise: (schema) => schema,
  }),
  gender: yup.string().oneOf(["male", "female", "other"], "Invalid gender"),
  client: yup.string().nullable(),
  clientBroker: yup.string().nullable(),
  clientNetwork: yup.string().nullable(),
  dob: yup.date().nullable(),
  address: yup.object().shape({
    street: yup.string().nullable(),
    city: yup.string().nullable(),
    postalCode: yup.string().nullable(),
  }),
  socialMedia: yup.object().shape({
    facebook: yup.string().nullable().url('Invalid Facebook URL'),
    twitter: yup.string().nullable().url('Invalid Twitter URL'),
    linkedin: yup.string().nullable().url('Invalid LinkedIn URL'),
    instagram: yup.string().nullable().url('Invalid Instagram URL'),
    telegram: yup.string().nullable(),
    whatsapp: yup.string().nullable()
  })
});

const getDefaultValues = (lead) => ({
  firstName: lead?.firstName ?? "",
  lastName: lead?.lastName ?? "",
  newEmail: lead?.newEmail ?? "",
  oldEmail: lead?.oldEmail ?? "",
  newPhone: lead?.newPhone ?? "",
  oldPhone: lead?.oldPhone ?? "",
  country: lead?.country ?? "",
  status: lead?.status ?? LEAD_STATUSES.ACTIVE,
  leadType: lead?.leadType ?? LEAD_TYPES.COLD,
  sin: lead?.sin ?? "",
  gender: lead?.gender ?? "other",
  client: lead?.client ?? "",
  clientBroker: lead?.clientBroker ?? "",
  clientNetwork: lead?.clientNetwork ?? "",
  dob: lead?.dob ?? "",
  address: {
    street: lead?.address?.street ?? "",
    city: lead?.address?.city ?? "",
    postalCode: lead?.address?.postalCode ?? "",
  },
  socialMedia: {
    facebook: lead?.socialMedia?.facebook ?? "",
    twitter: lead?.socialMedia?.twitter ?? "",
    linkedin: lead?.socialMedia?.linkedin ?? "",
    instagram: lead?.socialMedia?.instagram ?? "",
    telegram: lead?.socialMedia?.telegram ?? "",
    whatsapp: lead?.socialMedia?.whatsapp ?? "",
  }
});

const EditLeadForm = ({ open, onClose, lead, onLeadUpdated, sx }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: getDefaultValues(lead),
  });

  useEffect(() => {
    if (lead) {
      reset(getDefaultValues(lead));
    }
    setError(null);
  }, [lead, reset]);

  const leadType = watch("leadType");

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);

      // Transform data to match backend expectations
      const updateData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.newEmail, // Backend expects 'email' for newEmail
        phone: data.newPhone, // Backend expects 'phone' for newPhone
        country: data.country,
        status: data.status,
        leadType: data.leadType,
        sin: data.sin,
        gender: data.gender,
        socialMedia: data.socialMedia,
        // Note: Backend doesn't handle client fields, address, dob in updateLead
        // Only basic fields are supported in the current backend implementation
      };

      const response = await api.put(`/leads/${lead._id}`, updateData);
      if (response.data.success) {
        onLeadUpdated(response.data.data);
        onClose();
        reset();
      }
    } catch (error) {
      console.error("Error updating lead:", error);
      setError(error.response?.data?.message || "Failed to update lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={sx}
    >
      <DialogTitle>Edit Lead</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Basic Information</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    label="First Name"
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
                    value={field.value ?? ""}
                    fullWidth
                    label="Last Name"
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message}
                  />
                )}
              />
            </Grid>

            {/* Contact Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Contact Information</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="newEmail"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    label="Email"
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
                    fullWidth
                    label="Old Email"
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
                    fullWidth
                    label="Phone"
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
                    fullWidth
                    label="Old Phone"
                    error={!!errors.oldPhone}
                    helperText={errors.oldPhone?.message}
                  />
                )}
              />
            </Grid>

            {/* Lead Type and Status */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Lead Information</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.leadType}>
                <InputLabel>Lead Type</InputLabel>
                <Controller
                  name="leadType"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} label="Lead Type">
                      {Object.values(LEAD_TYPES).map((type) => (
                        <MenuItem key={type} value={type}>
                          {type.toUpperCase()}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.leadType && (
                  <Alert severity="error">{errors.leadType.message}</Alert>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.status}>
                <InputLabel>Status</InputLabel>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} label="Status">
                      {Object.values(LEAD_STATUSES).map((status) => (
                        <MenuItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.status && (
                  <Alert severity="error">{errors.status.message}</Alert>
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
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  )}
                />
                {errors.gender && (
                  <Alert severity="error">{errors.gender.message}</Alert>
                )}
              </FormControl>
            </Grid>
            {leadType === LEAD_TYPES.FTD && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="sin"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="SIN"
                      error={!!errors.sin}
                      helperText={errors.sin?.message}
                    />
                  )}
                />
              </Grid>
            )}

            {/* Client Information - Note: These are not handled by backend updateLead */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Client Information
                <Typography variant="caption" display="block" color="text.secondary">
                  (Note: These fields are displayed for reference but not currently supported for updates)
                </Typography>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="client"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Client"
                    disabled
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
                    fullWidth
                    label="Client Broker"
                    disabled
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
                    fullWidth
                    label="Client Network"
                    disabled
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="dob"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    disabled
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                )}
              />
            </Grid>

            {/* Address Information - Note: These are not handled by backend updateLead */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Address Information
                <Typography variant="caption" display="block" color="text.secondary">
                  (Note: These fields are displayed for reference but not currently supported for updates)
                </Typography>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="address.street"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Street Address"
                    disabled
                    error={!!errors.address?.street}
                    helperText={errors.address?.street?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="address.city"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="City"
                    disabled
                    error={!!errors.address?.city}
                    helperText={errors.address?.city?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="address.postalCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Postal Code"
                    disabled
                    error={!!errors.address?.postalCode}
                    helperText={errors.address?.postalCode?.message}
                  />
                )}
              />
            </Grid>

            {/* Social Media Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Social Media Information</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="socialMedia.facebook"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Facebook"
                    error={!!errors.socialMedia?.facebook}
                    helperText={errors.socialMedia?.facebook?.message}
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
                    fullWidth
                    label="Twitter"
                    error={!!errors.socialMedia?.twitter}
                    helperText={errors.socialMedia?.twitter?.message}
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
                    fullWidth
                    label="LinkedIn"
                    error={!!errors.socialMedia?.linkedin}
                    helperText={errors.socialMedia?.linkedin?.message}
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
                    fullWidth
                    label="Instagram"
                    error={!!errors.socialMedia?.instagram}
                    helperText={errors.socialMedia?.instagram?.message}
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
                    fullWidth
                    label="Telegram"
                    error={!!errors.socialMedia?.telegram}
                    helperText={errors.socialMedia?.telegram?.message}
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
                    fullWidth
                    label="WhatsApp"
                    error={!!errors.socialMedia?.whatsapp}
                    helperText={errors.socialMedia?.whatsapp?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? "Updating..." : "Update Lead"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EditLeadForm;