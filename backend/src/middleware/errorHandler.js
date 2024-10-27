const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error(err.stack);
  
    // Default error status and message
    let status = err.status || 500;
    let message = err.message || 'Internal Server Error';
  
    // Handle specific error types
    if (err.name === 'ValidationError') {
      status = 400;
      message = Object.values(err.errors).map(error => error.message).join(', ');
    } else if (err.name === 'JsonWebTokenError') {
      status = 401;
      message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
      status = 401;
      message = 'Token expired';
    }
  
    // Send error response
    res.status(status).json({
      error: {
        message,
        status,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  };
  
  module.exports = errorHandler;