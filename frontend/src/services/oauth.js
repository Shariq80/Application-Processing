export const handleOAuthCallback = (callback) => {
  const messageHandler = async (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'oauth-callback') {
      window.removeEventListener('message', messageHandler);
      if (event.data.success) {
        try {
          await callback();
        } catch (error) {
          console.error('OAuth callback error:', error);
        }
      }
    }
  };

  window.addEventListener('message', messageHandler);
  return () => window.removeEventListener('message', messageHandler);
};
