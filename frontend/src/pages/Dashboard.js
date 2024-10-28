import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import JobFormModal from '../components/Jobs/JobFormModal';
import EditJobModal from '../components/Jobs/EditJobModal';
import DeleteConfirmModal from '../components/Applications/DeleteConfirmModal';
import { toast } from 'react-hot-toast';
import { handleOAuthCallback } from '../services/oauth';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const [jobsRes, appsRes] = await Promise.all([
        api.get('/jobs'),
        api.get('/applications')
      ]);
      
      const jobsWithCount = jobsRes.data.map(job => ({
        ...job,
        applicationCount: appsRes.data.filter(app => 
          app.job && app.job._id === job._id
        ).length
      }));
      
      setJobs(jobsWithCount);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError('Failed to load jobs');
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;
    
    const toastId = toast.loading('Deleting job and associated applications...');
    try {
      await api.delete(`/jobs/${selectedJob._id}?deleteApplications=true`);
      toast.success('Job and associated applications deleted successfully', { id: toastId });
      setShowDeleteModal(false);
      setSelectedJob(null);
      await fetchJobs();
    } catch (error) {
      toast.error('Failed to delete job', { id: toastId });
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleGoogleAuth = async () => {
    try {
      const response = await api.get('/auth/google/url');
      const popup = window.open(
        response.data.url,
        'Google Auth',
        'width=500,height=600'
      );
  
      const cleanup = handleOAuthCallback(async () => {
        popup.close();
        toast.success('Gmail connected successfully');
        await fetchJobs();
      });
  
      return () => cleanup();
    } catch (error) {
      console.error('Google auth error:', error);
      toast.error('Failed to connect Gmail');
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Error Loading Jobs</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchJobs}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Jobs</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Create Job
          </button>
          <button
            onClick={handleGoogleAuth}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
          >
            Connect Gmail
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">No.</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Applications</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created At</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {jobs.map((job, index) => (
                    <tr key={job._id}>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {index + 1}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className="font-semibold text-gray-900">{job.title}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          {job.applicationCount || 0} applications
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded ${
                          job.status === 'Open' ? 'bg-green-100 text-green-800' :
                          job.status === 'Closed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'  // For 'On Hold' status
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex justify-end space-x-4">
                          <button
                            onClick={() => navigate(`/jobs/${job._id}`)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <JobFormModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchJobs();
          }}
        />
      )}

      {selectedJob && !showDeleteModal && (
        <EditJobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSuccess={() => {
            setSelectedJob(null);
            fetchJobs();
          }}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Job"
          message="Are you sure you want to delete this job and all its applications? This action cannot be undone."
          onConfirm={handleDeleteJob}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}
