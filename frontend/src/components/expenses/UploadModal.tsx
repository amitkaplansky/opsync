import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileText, Image, AlertTriangle, CheckCircle } from 'lucide-react';
import { uploadApi } from '@/services/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import toast from 'react-hot-toast';

interface UploadModalProps {
  onClose: () => void;
  onUpload: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [sensitivityLevel, setSensitivityLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [editedProviderName, setEditedProviderName] = useState<string>('');
  const [editedSensitivity, setEditedSensitivity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [editedDueDate, setEditedDueDate] = useState<string>('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const result = await uploadApi.uploadInvoice(file, sensitivityLevel);
      setUploadResult(result);
      // Clean up OCR-extracted vendor name by removing "page X of Y" text
      const cleanedVendorName = result.ocrResults.extractedData.vendor?.replace(/page?\s*\d+\s*of\s*\d+/gi, '').trim() || '';
      setEditedProviderName(cleanedVendorName);
      setEditedSensitivity(sensitivityLevel);
      toast.success('Invoice uploaded and processed successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    acceptedFiles,
    fileRejections
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading || !!uploadResult
  });

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="w-8 h-8 text-security-high" />;
    }
    return <Image className="w-8 h-8 text-security-medium" />;
  };

  const handleConfirmUpload = async () => {
    if (uploadResult && editedProviderName.trim()) {
      try {
        // Create manual expense with edited provider name and sensitivity
        await uploadApi.createExpenseFromUpload({
          provider_name: editedProviderName.trim(),
          description: `Invoice: ${uploadResult.file.originalName}`,
          amount: parseFloat(uploadResult.ocrResults.extractedData.amount) || 0,
          currency: uploadResult.ocrResults.extractedData.currency || 'USD',
          date: uploadResult.ocrResults.extractedData.date || new Date().toISOString().split('T')[0],
          sensitivity: editedSensitivity,
          file_path: uploadResult.file.path
        });
        toast.success('Expense created successfully');
        onUpload();
      } catch (error: any) {
        toast.error('Failed to create expense: ' + (error.response?.data?.error || error.message));
      }
    } else {
      toast.error('Please enter a provider name');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary-button bg-opacity-20">
              <Upload className="w-5 h-5 text-primary-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-primary-text">
              Upload Invoice
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-primary-button hover:bg-opacity-20 transition-colors"
          >
            <X className="w-5 h-5 text-primary-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sensitivity Level Selector */}
          {!uploadResult && (
            <div>
              <label className="block text-sm font-medium text-primary-text mb-3">
                Sensitivity Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSensitivityLevel(level)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      sensitivityLevel === level
                        ? 'border-primary-button bg-primary-button bg-opacity-20'
                        : 'border-primary-border hover:border-primary-button hover:border-opacity-50'
                    }`}
                  >
                    <div className="text-center">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                        level === 'LOW' ? 'bg-security-low' :
                        level === 'MEDIUM' ? 'bg-security-medium' : 'bg-security-high'
                      }`} />
                      <span className="text-sm font-medium">{level}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-primary-secondary">
                HIGH: Security/government vendors (will be masked)<br />
                MEDIUM: Cloud providers (AWS, GCP, Azure)<br />
                LOW: Common SaaS tools (Slack, Jira, etc.)
              </p>
            </div>
          )}

          {/* Upload Area */}
          {!uploadResult && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragActive
                  ? 'border-primary-button bg-primary-button bg-opacity-10'
                  : 'border-primary-border hover:border-primary-button hover:border-opacity-50'
              } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
            >
              <input {...getInputProps()} />
              
              {isUploading ? (
                <div className="space-y-4">
                  <LoadingSpinner size="large" />
                  <div>
                    <p className="text-lg font-medium text-primary-text">
                      Processing Invoice...
                    </p>
                    <p className="text-sm text-primary-secondary mt-1">
                      Extracting data with OCR and applying security policies
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-primary-secondary mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-primary-text">
                      {isDragActive ? 'Drop your invoice here' : 'Drag & drop your invoice'}
                    </p>
                    <p className="text-sm text-primary-secondary mt-1">
                      or click to browse files
                    </p>
                  </div>
                  <div className="text-xs text-primary-secondary">
                    Supports PDF, JPEG, PNG • Max 10MB
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Rejections */}
          {fileRejections.length > 0 && (
            <div className="space-y-2">
              {fileRejections.map(({ file, errors }) => (
                <div key={file.name} className="p-3 rounded-lg bg-security-high bg-opacity-10 border border-security-high border-opacity-20">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-security-high mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-security-high">
                        {file.name}
                      </p>
                      <ul className="text-xs text-security-high mt-1">
                        {errors.map((error) => (
                          <li key={error.code}>• {error.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Success Result */}
          {uploadResult && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 p-4 rounded-lg bg-security-low bg-opacity-10 border border-security-low border-opacity-20">
                <CheckCircle className="w-6 h-6 text-security-low flex-shrink-0" />
                <div>
                  <p className="font-medium text-primary-text">Upload Successful</p>
                  <p className="text-sm text-primary-secondary">
                    Invoice processed and data extracted
                  </p>
                </div>
              </div>

              {/* File Info */}
              <div className="card p-4 bg-primary-bg">
                <h3 className="font-medium text-primary-text mb-3">File Information</h3>
                <div className="flex items-center space-x-3">
                  {getFileIcon(uploadResult.file.type)}
                  <div>
                    <p className="font-medium text-primary-text">
                      {uploadResult.file.originalName}
                    </p>
                    <p className="text-sm text-primary-secondary">
                      {(uploadResult.file.size / 1024 / 1024).toFixed(2)} MB • {uploadResult.file.type}
                    </p>
                  </div>
                </div>
              </div>

              {/* OCR Results */}
              <div className="card p-4 bg-primary-bg">
                <h3 className="font-medium text-primary-text mb-3">Extracted Data</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-primary-secondary">Vendor (Original)</label>
                    <p className="text-sm text-primary-text">
                      {uploadResult.ocrResults.extractedData.vendor?.replace(/page?\s*\d+\s*of\s*\d+/gi, '').trim() || 'Not detected'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-primary-secondary">Amount</label>
                    <p className="text-sm text-primary-text">{uploadResult.ocrResults.extractedData.amount} {uploadResult.ocrResults.extractedData.currency}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-primary-secondary">Date</label>
                    <p className="text-sm text-primary-text">{uploadResult.ocrResults.extractedData.date}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-primary-secondary">Confidence</label>
                    <p className="text-sm text-primary-text">
                      {uploadResult.ocrResults.confidence && !isNaN(uploadResult.ocrResults.confidence) 
                        ? `${(uploadResult.ocrResults.confidence * 100).toFixed(1)}%` 
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Edit Provider and Sensitivity */}
              <div className="card p-4 bg-primary-bg">
                <h3 className="font-medium text-primary-text mb-3">Edit Invoice Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      Provider Name
                    </label>
                    <input
                      type="text"
                      value={editedProviderName}
                      onChange={(e) => setEditedProviderName(e.target.value)}
                      className="input w-full"
                      placeholder="Enter provider name"
                    />
                    <p className="text-xs text-primary-secondary mt-1">
                      You can edit the provider name extracted from OCR
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      Sensitivity Level
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setEditedSensitivity(level)}
                          className={`p-3 rounded-lg border-2 transition-colors ${
                            editedSensitivity === level
                              ? 'border-primary-button bg-primary-button bg-opacity-20'
                              : 'border-primary-border hover:border-primary-button hover:border-opacity-50'
                          }`}
                        >
                          <div className="text-center">
                            <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                              level === 'LOW' ? 'bg-security-low' :
                              level === 'MEDIUM' ? 'bg-security-medium' : 'bg-security-high'
                            }`} />
                            <span className="text-sm font-medium">{level}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-primary-text mb-2">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={editedDueDate}
                      onChange={(e) => setEditedDueDate(e.target.value)}
                      className="input w-full"
                    />
                    <p className="text-xs text-primary-secondary mt-1">
                      Set a due date if this invoice needs to be paid by a specific date
                    </p>
                  </div>
                </div>
              </div>

              {/* Extracted Text Preview */}
              <div className="card p-4 bg-primary-bg">
                <h3 className="font-medium text-primary-text mb-3">OCR Text Preview</h3>
                <div className="text-xs text-primary-secondary bg-white p-3 rounded border max-h-32 overflow-y-auto">
                  {uploadResult.ocrResults.text}
                </div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="p-4 rounded-lg bg-primary-button bg-opacity-10 border border-primary-border">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-primary-secondary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-primary-text mb-1">Security & Retention Policy</p>
                <ul className="text-primary-secondary space-y-1">
                  <li>• Files are encrypted before storage</li>
                  <li>• Small invoices (&lt;$5K) are deleted after data extraction</li>
                  <li>• Large invoices (&gt;$20K) are kept permanently for audit</li>
                  <li>• High-sensitivity files are always encrypted and retained</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          {uploadResult && (
            <div className="flex justify-end pt-4 border-t border-primary-border">
              <button
                type="button"
                onClick={handleConfirmUpload}
                className="btn btn-primary"
              >
                Create Invoice Record
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal;