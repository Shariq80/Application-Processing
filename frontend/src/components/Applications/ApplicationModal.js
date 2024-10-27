import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

export default function ApplicationModal({ application, onClose, onDelete, onToggleShortlist }) {
  const [isShortlisted, setIsShortlisted] = useState(application.isShortlisted);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleShortlistClick = async () => {
    if (application.sentAt) return;
    
    setIsUpdating(true);
    
    try {
      await onToggleShortlist(application._id);
      setIsShortlisted(prev => !prev); // Only update once after success
    } catch (error) {
      console.error('Failed to update shortlist status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownload = async (attachmentId, filename) => {
    try {
      const blob = await api.downloadAttachment(application._id, attachmentId);
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      // Clean up the URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                  onClick={onClose}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                    Application Details
                  </Dialog.Title>

                  <div className="mt-4 space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900">Application Status</h4>
                      <div className="mt-1">
                        {application.sentAt ? (
                          <span className="px-2 py-1 rounded bg-green-100 text-green-800">
                            Sent on {new Date(application.sentAt).toLocaleDateString()}
                          </span>
                        ) : application.isShortlisted ? (
                          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                            Shortlisted - Not Sent
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">
                            Not Shortlisted
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900">Applicant Information</h4>
                      <p className="mt-1">Name: {application.applicantName}</p>
                      <p>Email: {application.applicantEmail}</p>
                      <p>Applied on: {new Date(application.createdAt).toLocaleString()}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900">AI Assessment</h4>
                      <p className="mt-1">Score: {application.aiScore}/10</p>
                      <p className="whitespace-pre-wrap">Summary: {application.aiSummary}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900">Email Content</h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500">
                        {application.emailBody}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900">Attachments</h4>
                      <div className="mt-2 space-y-2">
                        {application.attachments.map((attachment) => (
                          <button
                            key={attachment._id}
                            onClick={() => handleDownload(attachment._id, attachment.filename)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                          >
                            <DocumentArrowDownIcon className="mr-2 h-4 w-4" />
                            Download {attachment.filename}
                          </button>
                        ))}
                        {application.attachments.length === 0 && (
                          <p className="text-sm text-gray-500">No attachments available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-between items-center">
                    <div className="space-x-2">
                      <button
                        onClick={handleShortlistClick}
                        disabled={application.sentAt || isUpdating}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          application.sentAt
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isShortlisted
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {isUpdating ? (
                          <span className="inline-flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Updating...
                          </span>
                        ) : (
                          <>
                            {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                            {application.sentAt && ' (Sent)'}
                          </>
                        )}
                      </button>
                      <button
                        onClick={onDelete}
                        className="px-3 py-2 rounded-md text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
