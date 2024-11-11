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

        // Get the auth token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          setStatus('error');
          setMessage('Authentication token not found');
          return;
        }

        // Set the authorization header for this request
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        const response = await api.get(`/auth/google/callback?code=${code}`);
        
        if (response.data.success) {
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-callback', success: true }, window.location.origin);
          }
          
          setStatus('success');
          setMessage(response.data.message || 'Gmail connected successfully! This window will close shortly.');
          
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
