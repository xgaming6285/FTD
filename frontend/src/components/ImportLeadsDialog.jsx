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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Chip,
} from '@mui/material';
import { 
  FileUpload as ImportIcon, 
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon 
} from '@mui/icons-material';
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
  const [csvPreview, setCsvPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

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
      setCsvPreview(null);
      
      // Generate preview
      generatePreview(file);
    } else {
      setSelectedFile(null);
      setCsvPreview(null);
    }
  };

  const generatePreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvData = e.target.result;
        const rows = csvData.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        
        if (rows.length > 0) {
          const headers = rows[0].split(',').map(header => header.trim().replace(/"/g, ''));
          const dataRows = rows.slice(1, Math.min(6, rows.length)); // Show first 5 data rows
          
          setCsvPreview({
            headers,
            dataRows: dataRows.map(row => {
              // Simple CSV parsing for preview
              const fields = row.split(',').map(field => field.trim().replace(/"/g, ''));
              return fields;
            }),
            totalRows: rows.length - 1 // Subtract header row
          });
        }
      } catch (error) {
        console.error('Error generating preview:', error);
      }
    };
    reader.readAsText(file);
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
        // Don't auto-close if there are errors to show
        if (!response.data.data.errors || response.data.data.errors.length === 0) {
          setTimeout(() => {
            onClose();
          }, 2000);
        }
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
    setCsvPreview(null);
    setShowPreview(false);
    setShowErrors(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
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

        {/* CSV Preview */}
        {csvPreview && (
          <Box sx={{ my: 2 }}>
            <Button
              onClick={() => setShowPreview(!showPreview)}
              startIcon={<PreviewIcon />}
              endIcon={showPreview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              variant="outlined"
              size="small"
            >
              {showPreview ? 'Hide Preview' : `Preview CSV (${csvPreview.totalRows} rows)`}
            </Button>
            
            <Collapse in={showPreview}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  CSV Preview - First 5 rows:
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {csvPreview.headers.map((header, index) => (
                          <TableCell key={index} sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                            {header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {csvPreview.dataRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} sx={{ fontSize: '0.75rem', maxWidth: 100 }}>
                              {cell || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Collapse>
          </Box>
        )}

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
                  Successfully imported {importResults.imported} out of {importResults.total} leads
                  {importResults.errors?.length > 0 && (
                    <>
                      {' with '}
                      <Chip 
                        size="small" 
                        label={`${importResults.errors.length} errors`}
                        color="warning"
                        onClick={() => setShowErrors(!showErrors)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </>
                  )}
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        {/* Error Details */}
        {importResults?.errors?.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Collapse in={showErrors}>
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Import Errors:
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {importResults.errors.slice(0, 10).map((error, index) => (
                    <Typography key={index} variant="caption" display="block">
                      Row {error.row}: {error.error}
                    </Typography>
                  ))}
                  {importResults.errors.length > 10 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {importResults.errors.length - 10} more errors
                    </Typography>
                  )}
                </Box>
              </Alert>
            </Collapse>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Expected CSV format: gender, first name, last name, old email, new email, prefix, old phone, new phone, agent, Extension, Date of birth, address, Facebook, Twitter, Linkedin, Instagram, Telegram, ID front, ID back, Selfie front, Selfie back, ID remark, GEO
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 'bold' }}>
            Note: Use exact column names - agent, Extension, Date of birth, address, Facebook, Twitter, Linkedin, Instagram, Telegram, ID front, ID back, Selfie front, Selfie back, ID remark, GEO
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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