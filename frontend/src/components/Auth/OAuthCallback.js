import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state'); // Get the token from state
        
        if (!code || !state) {
          setStatus('error');
          setMessage('Missing required parameters');
          return;
        }

        const response = await api.get(`/auth/google/callback?code=${code}&state=${state}`);
        
        if (response.data.success) {
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'oauth-callback', 
              success: true 
            }, window.location.origin);
          }
          
          setStatus('success');
          setMessage('Gmail connected successfully! This window will close shortly.');
          
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Failed to connect Gmail account');
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Processing...
              </h2>
            </>
          )}
          {status === 'success' && (
            <h2 className="mt-6 text-3xl font-extrabold text-green-600">
              Success!
            </h2>
          )}
          {status === 'error' && (
            <h2 className="mt-6 text-3xl font-extrabold text-red-600">
              Error
            </h2>
          )}
          <p className="mt-2 text-sm text-gray-600">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
