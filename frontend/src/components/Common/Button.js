export default function Button({ 
    children, 
    variant = 'primary', 
    isLoading = false, 
    disabled = false,
    ...props 
  }) {
    const baseClasses = "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm";
    
    const variants = {
      primary: "text-white bg-indigo-600 hover:bg-indigo-700",
      secondary: "text-gray-700 bg-white border-gray-300 hover:bg-gray-50",
      danger: "text-white bg-red-600 hover:bg-red-700"
    };
  
    return (
      <button
        disabled={disabled || isLoading}
        className={`
          ${baseClasses}
          ${variants[variant]}
          ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </>
        ) : children}
      </button>
    );
  }