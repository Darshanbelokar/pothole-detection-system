import { useState } from 'react';
import { uploadVideo } from '../services/api';

export default function VideoUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Please select a video file first.');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);

    try {
      const response = await uploadVideo(file);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Could not upload video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>Upload Dashcam Video</h2>
      <form className="upload-form" onSubmit={handleUpload}>
        <label className="file-input-wrap">
          <input
            type="file"
            accept="video/*"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <span>{file ? file.name : 'Choose video file...'}</span>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Upload & Detect'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result-box">
          <p className="result-title"><strong>File:</strong> {result.fileName}</p>
          <div className="result-grid">
            <p><strong>Frames Checked:</strong> {result.totalFramesChecked}</p>
            <p><strong>Potholes Found:</strong> {result.potholesFound}</p>
          </div>
        </div>
      )}
    </section>
  );
}
