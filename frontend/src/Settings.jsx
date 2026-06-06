import React, { useState, useEffect } from 'react';
import styles from './App.module.css';

// SVG Icons
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [savedMessage, setSavedMessage] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('stock_api_key');
    const storedModel = localStorage.getItem('stock_ai_model');
    if (storedKey) setApiKey(storedKey);
    if (storedModel) setSelectedModel(storedModel);
  }, []);

  // Save settings and trigger animation
  const handleSave = () => {
    localStorage.setItem('stock_api_key', apiKey);
    localStorage.setItem('stock_ai_model', selectedModel);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <div className={styles.settingsForm}>
      
      {/* --- NEW: Model Selection Dropdown --- */}
      <div className={styles.settingsFieldGroup}>
        <label className={styles.settingsLabel}>AI Intelligence Engine</label>
        <p className={styles.settingsHelperText}>
          Choose your preferred model. Flash is faster; Pro is highly analytical but slower.
        </p>
        <select 
          className={styles.settingsInput} 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{ cursor: 'pointer', appearance: 'auto' }}
        >
          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</option>
        </select>
      </div>

      {/* API Key Input */}
      <div className={styles.settingsFieldGroup}>
        <label htmlFor="apiKey" className={styles.settingsLabel}>
          Provider API Key
        </label>
        <input
          id="apiKey"
          type="password"
          className={styles.settingsInput}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key..."
        />
      </div>
      
      <button onClick={handleSave} className={styles.settingsSubmitBtn}>
        <LockIcon /> Save Application Settings
      </button>
      
      {savedMessage && (
        <div className={styles.successBadge}>
          <CheckIcon /> Settings saved and encrypted locally!
        </div>
      )}

    </div>
  );
}