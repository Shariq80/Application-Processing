import { useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export default function ApplicationsTable({ applications, onViewDetails, onToggleShortlist }) {
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedApplications = [...applications].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === 'createdAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="h-4 w-4 inline-block ml-1" /> :
      <ChevronDownIcon className="h-4 w-4 inline-block ml-1" />;
  };

  const getEmailOnly = (fullEmail) => {
    const matches = fullEmail.match(/<(.+?)>/);
    return matches ? matches[1] : fullEmail;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              No.
            </th>
            <th 
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSort('applicantName')}
            >
              Name <SortIcon field="applicantName" />
            </th>
            <th 
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSort('createdAt')}
            >
              Date <SortIcon field="createdAt" />
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Email
            </th>
            <th 
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
              onClick={() => handleSort('aiScore')}
            >
              AI Score <SortIcon field="aiScore" />
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Status
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedApplications.map((app, index) => (
            <tr key={app._id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {index + 1}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                {app.applicantName}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(app.createdAt).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {getEmailOnly(app.applicantEmail)}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                <span className={`px-2 py-1 rounded ${
                  app.aiScore >= 7 ? 'bg-green-100 text-green-800' :
                  app.aiScore >= 5 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {app.aiScore}/10
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {app.sentAt ? (
                  <span className="px-2 py-1 rounded bg-green-100 text-green-800">
                    Sent on {new Date(app.sentAt).toLocaleDateString()}
                  </span>
                ) : app.isShortlisted ? (
                  <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                    Shortlisted - Not Sent
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">
                    Not Shortlisted
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 space-x-2">
                <button
                  onClick={() => onViewDetails(app)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td colSpan="7" className="px-3 py-4 text-sm text-gray-500 text-center">
                No applications found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
