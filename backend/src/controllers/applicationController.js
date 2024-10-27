const gmailService = require('../services/gmailService');
const openaiService = require('../services/openaiService');
const Application = require('../models/Application');
const Job = require('../models/Job');
const resumeParserService = require('../services/resumeParserService');

exports.fetchEmails = async (req, res) => {
  try {
    const { jobTitle } = req.query;
    console.log('Searching for job title:', jobTitle);
    
    if (!jobTitle) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    const existingJob = await Job.findOne({ 
      title: { $regex: new RegExp(`^${jobTitle}$`, 'i') }
    });
    console.log('Found job:', existingJob);
    
    const gmail = await gmailService.getAuthorizedClient();
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread ${jobTitle}`
    });

    console.log('Gmail response:', response.data);
    const emails = response.data.messages || [];
    console.log('Found emails:', emails.length);

    const processedEmails = [];

    for (const email of emails) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: email.id,
        format: 'full'
      });

      try {
        const processedEmail = await this.processEmail(emailData.data, jobTitle);
        processedEmails.push(processedEmail);

        // Mark as read only if successfully processed
        await gmail.users.messages.modify({
          userId: 'me',
          id: email.id,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });
      } catch (error) {
        console.error(`Failed to process email: ${error.message}`);
        // Continue with next email if one fails
        continue;
      }
    }

    res.json({ success: true, applications: processedEmails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.processEmail = async (emailData, jobTitle) => {
  try {
    const headers = emailData.payload.headers;
    const subject = headers.find(h => h.name === 'Subject').value;
    const from = headers.find(h => h.name === 'From').value;
    
    // Case-insensitive check if subject contains job title
    if (!subject.toLowerCase().includes(jobTitle.toLowerCase())) {
      throw new Error('Job title not found in subject');
    }

    // Find corresponding job - case insensitive search
    const job = await Job.findOne({ 
      title: { $regex: new RegExp(`^${jobTitle}$`, 'i') }
    });
    
    if (!job) {
      throw new Error(`No matching job found for title: ${jobTitle}`);
    }

    // Process attachments
    const attachments = [];
    let resumeText = '';
    
    if (emailData.payload.parts) {
      for (const part of emailData.payload.parts) {
        if (part.filename && (
          part.filename.endsWith('.pdf') || 
          part.filename.endsWith('.doc') || 
          part.filename.endsWith('.docx')
        )) {
          console.log('Processing attachment:', {
            filename: part.filename,
            mimeType: part.mimeType,
            hasAttachmentId: !!part.body.attachmentId
          });

          if (part.body.attachmentId) {
            try {
              // Get attachment data from Gmail
              const gmail = await gmailService.getAuthorizedClient();
              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: emailData.id,
                id: part.body.attachmentId
              });

              if (attachment?.data?.data) {
                // Store attachment metadata and binary data
                attachments.push({
                  filename: part.filename,
                  contentType: part.mimeType,
                  data: Buffer.from(attachment.data.data, 'base64'),
                  attachmentId: part.body.attachmentId
                });

                // Parse resume text
                const buffer = Buffer.from(attachment.data.data, 'base64');
                const text = await resumeParserService.parseResume(buffer, part.mimeType);
                if (text && text.trim()) {
                  resumeText = text;
                  break; // Use the first successfully parsed resume
                }
              }
            } catch (err) {
              console.error('Resume processing error:', err);
              // Continue to next attachment if one fails
            }
          }
        }
      }
    }

    // Extract email body
    let emailBody = '';
    if (emailData.payload.body && emailData.payload.body.data) {
      // For simple emails
      emailBody = Buffer.from(emailData.payload.body.data, 'base64').toString();
    } else if (emailData.payload.parts) {
      // For multipart emails
      const textPart = emailData.payload.parts.find(
        part => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      if (textPart && textPart.body.data) {
        emailBody = Buffer.from(textPart.body.data, 'base64').toString();
      } else {
        // Try to find nested parts
        for (const part of emailData.payload.parts) {
          if (part.parts) {
            const nestedTextPart = part.parts.find(
              p => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
            );
            if (nestedTextPart && nestedTextPart.body.data) {
              emailBody = Buffer.from(nestedTextPart.body.data, 'base64').toString();
              break;
            }
          }
        }
      }
    }
    
    // Use placeholder if body is empty
    emailBody = emailBody.trim() || 'No email body content available';

    // Combine resume text and email body for better analysis
    const textForAnalysis = [
      resumeText || 'No resume text available',
      emailBody || 'No email body available'
    ].join('\n\n');

    // Get AI scoring
    const aiResult = await openaiService.scoreResume(textForAnalysis, job.description);

    // Create application
    const application = new Application({
      job: job._id,
      applicantName: from.split('<')[0].trim(),
      applicantEmail: from.match(/<(.+)>/)[1],
      resumeText: resumeText || 'No resume text available',
      emailBody: emailBody,
      aiScore: aiResult.score,
      aiSummary: aiResult.summary,
      emailId: emailData.id,
      attachments
    });

    await application.save();
    return application;
  } catch (error) {
    throw error;
  }
};

exports.getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('job')
      .sort('-createdAt');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('job');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { applicationId, attachmentId } = req.params;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const attachment = application.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Set response headers for file download
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);

    // Send the file buffer
    res.send(attachment.data);

  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
};
