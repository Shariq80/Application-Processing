const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');

router.get('/fetch-emails', applicationController.fetchEmails);
router.get('/', applicationController.getAllApplications);
router.get('/:id', applicationController.getApplication);
router.post('/process-email', applicationController.processEmail);
router.get('/:applicationId/attachments/:attachmentId', applicationController.downloadAttachment);

module.exports = router;