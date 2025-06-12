import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { FileUpload as ImportIcon } from '@mui/icons-material';
import api from '../services/api';

const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
  LIVE: "live",
};

const ImportLeadsDialog = ({ open, onClose, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLeadType, setSelectedLeadType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [importResults, setImportResults] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    console.log("Selected file:", file);

    if (file) {
      // Validate file type
      const validTypes = [
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      const isValidType =
        validTypes.includes(file.type) || file.name.endsWith(".csv");

      if (!isValidType) {
        setError("Please upload a valid CSV file");
        setSelectedFile(null);
        return;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError("File size must be less than 10MB");
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setError(null);
      setSuccess(null);
      setImportResults(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedLeadType) {
      setError("Please select both a file and a lead type");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("leadType", selectedLeadType);

      // Log the FormData contents for debugging
      console.log('FormData contents:', {
        file: selectedFile,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        fileName: selectedFile.name,
        leadType: selectedLeadType
      });

      // Make API request
      const response = await api.post("/leads/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log('Upload progress:', percentCompleted);
        }
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setImportResults(response.data.data);
        if (onImportComplete) {
          onImportComplete();
        }
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(response.data.message || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to import leads"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setSelectedLeadType("");
    setError(null);
    setSuccess(null);
    setImportResults(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Leads</DialogTitle>
      <DialogContent>
        <Box sx={{ my: 2 }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="csv-file-input"
          />
          <label htmlFor="csv-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<ImportIcon />}
              fullWidth
            >
              {selectedFile ? selectedFile.name : "Select CSV File"}
            </Button>
          </label>
        </Box>

        <Box sx={{ my: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Lead Type</InputLabel>
            <Select
              value={selectedLeadType}
              label="Lead Type"
              onChange={(e) => setSelectedLeadType(e.target.value)}
            >
              {Object.entries(LEAD_TYPES).map(([key, value]) => (
                <MenuItem key={value} value={value}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
            {importResults && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Successfully imported {importResults.imported} leads
                  {importResults.errors?.length > 0 && (
                    <> with {importResults.errors.length} errors</>
                  )}
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Download a{" "}
            <Link
              href="/sample-leads.csv"
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              sample CSV template
            </Link>
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!selectedFile || !selectedLeadType || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportLeadsDialog;