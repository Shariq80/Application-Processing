import { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) {
          setStatus('error');
          setMessage('No authorization code found');
          return;
        }

        // Call the backend to process the code
        const response = await api.get(`/auth/google/callback?code=${code}`);
        
        if (response.data.success) {
          // Notify the opener window about success
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-callback', success: true }, window.location.origin);
          }
          
          setStatus('success');
          setMessage(response.data.message || 'Gmail connected successfully! This window will close shortly.');
          
          // Close the window after showing success message
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          throw new Error(response.data.error || 'Authentication failed');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || error.message || 'Authentication failed');
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
        {status === 'processing' && (
          <div className="animate-pulse">
            <div className="text-lg text-gray-600">Processing authentication...</div>
          </div>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Authentication Successful</h2>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Authentication Failed</h2>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-500"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
