import { useState } from 'react';
import api from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';

export default function EditJobModal({ job, onClose, onSuccess }) {
  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description);
  const [status, setStatus] = useState(job.status || 'Open');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.put(`/jobs/${job._id}`, { title, description, status });
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalActions = (
    <>
      <Button type="submit" form="edit-job-form" isLoading={isSubmitting}>
        Update Job
      </Button>
      <Button type="button" variant="secondary" onClick={onClose} className="mr-3">
        Cancel
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Job"
      actions={modalActions}
    >
      <form id="edit-job-form" onSubmit={handleSubmit} className="mt-4">
        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Job Title
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g. Senior Software Engineer"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Job Description
            </label>
            <div className="mt-1">
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter the job description and requirements..."
                required
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
