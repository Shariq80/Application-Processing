const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');

// Put specific routes before parameterized routes
router.get('/fetch-emails', (req, res, next) => {
  applicationController.fetchEmails(req, res, next);
});

// Fix: Add leading slash and add debug logging
router.post('/send-shortlisted', (req, res, next) => {
  applicationController.sendShortlistedApplications(req, res, next);
});

// Add debug logging for shortlist route
router.patch('/:id/shortlist', (req, res, next) => {
  applicationController.toggleShortlist(req, res, next);
});

router.get('/', applicationController.getAllApplications);
router.get('/:id', applicationController.getApplication);
router.post('/process-email', applicationController.processEmail);
router.get('/:applicationId/attachments/:attachmentId', applicationController.downloadAttachment);
router.delete('/:id', applicationController.deleteApplication);

module.exports = router;
