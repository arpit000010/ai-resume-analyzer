import { useState } from 'react';
import { analyzeResume } from '../services/analyzer.js';
import { validateInputs } from '../utils/validation.js';

export function useAnalysis() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const changeFile = (next) => {
    if (loading) return;
    setFile(next); setData(null); setError('');
  };
  const changeDescription = (next) => {
    if (loading) return;
    setJobDescription(next); setData(null); setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const validation = validateInputs(file, jobDescription);
    setError(validation); setData(null);
    if (validation) return;
    setLoading(true);
    try { setData(await analyzeResume(file, jobDescription)); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  };
  return { file, jobDescription, data, error, loading, changeFile, changeDescription, submit };
}
