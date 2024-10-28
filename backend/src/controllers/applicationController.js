const gmailService = require('../services/gmailService');
const openaiService = require('../services/openaiService');
const Application = require('../models/Application');
const Job = require('../models/Job');
const resumeParserService = require('../services/resumeParserService');
const mongoose = require('mongoose');

exports.fetchEmails = async (req, res) => {
  try {
    const { jobTitle } = req.query;
    
    if (!jobTitle) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    const existingJob = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
    });
    
    if (!existingJob) {
      return res.status(404).json({ 
        error: `No job found matching "${jobTitle}". Please create the job first.` 
      });
    }

    const gmail = await gmailService.getAuthorizedClient();


    const emails = response.data.messages || [];
    
    const processedEmails = [];

    for (const email of emails) {

      try {
        const processedEmail = await this.processEmail(emailData.data, jobTitle);
        processedEmails.push(processedEmail);
        console.log('Email processed successfully:', email.id);

        await gmail.users.messages.modify({
          userId: 'me',
          id: email.id,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });
        console.log('Email marked as read:', email.id);
      } catch (error) {
        console.error('Failed to process email:', {
          emailId: email.id,
          error: error.message,
          stack: error.stack
        });
        continue;
      }
    }

    console.log('\n=== Completed fetchEmails ===');
    console.log('Successfully processed', processedEmails.length, 'out of', emails.length, 'emails');
    
    res.json({ success: true, applications: processedEmails });
  } catch (error) {
    console.error('Fatal error in fetchEmails:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
};

exports.processEmail = async (emailData, jobTitle) => {
  console.log('\n=== Starting processEmail ===');
  try {
    const headers = emailData.payload.headers;
    const subject = headers.find(h => h.name === 'Subject').value;
    const from = headers.find(h => h.name === 'From').value;
    

    if (!subject.toLowerCase().includes(jobTitle.toLowerCase())) {
      throw new Error('Job title not found in subject');
    }

    const job = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
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
    const { jobId } = req.query;
    
    // Ensure jobId is a valid ObjectId
    if (jobId && !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Build query with job filter if jobId is provided
    const query = jobId ? { job: jobId } : {};

    const applications = await Application.find(query)
      .populate('job')
      .sort('-createdAt');

    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
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

exports.toggleShortlist = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    application.isShortlisted = !application.isShortlisted;
    await application.save();
    
    res.json({ 
      isShortlisted: application.isShortlisted,
      message: `Application ${application.isShortlisted ? 'shortlisted' : 'removed from shortlist'}`
    });
  } catch (error) {
    console.error('Error in toggleShortlist:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.sendShortlistedApplications = async (req, res) => {
  try {
    console.log('\n=== Starting sendShortlistedApplications ===');
    
    const { jobId } = req.body;
    
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    // Find all shortlisted but unsent applications for this job
    const applications = await Application.find({
      job: jobId,
      isShortlisted: true,
      sentAt: null
    }).populate('job');

    if (!applications.length) {
      throw new Error('No unsent shortlisted applications found');
    }

    // Get Gmail client
    const gmail = await gmailService.getAuthorizedClient();

    // Create HTML content for email
    const htmlContent = `
      <h2>Shortlisted Applications for ${applications[0].job.title}</h2>
      ${applications.map(app => `
        <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
          <h3>${app.applicantName}</h3>
          <p><strong>Email:</strong> ${app.applicantEmail}</p>
          <p><strong>AI Score:</strong> ${app.aiScore}/10</p>
          <p><strong>AI Summary:</strong> ${app.aiSummary}</p>
          <p><strong>Date Received:</strong> ${new Date(app.createdAt).toLocaleDateString()}</p>
          <p><strong>Email Body:</strong></p>
          <div style="margin-left: 20px;">${app.emailBody}</div>
        </div>
      `).join('')}
    `;

    // Create message with attachments
    const boundary = 'boundary' + Date.now().toString();
    const message = [
      `Content-Type: multipart/mixed; boundary=${boundary}`,
      'MIME-Version: 1.0',
      `To: ${req.user.email}`,  // Use the authenticated user's email from req.user
      `Subject: Shortlisted Applications for ${applications[0].job.title}`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ];

    // Add attachments
    for (const app of applications) {
      for (const attachment of app.attachments) {
        message.push(
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.data.toString('base64')
        );
      }
    }

    message.push(`--${boundary}--`);

    // Encode and send the email
    const encodedMessage = Buffer.from(message.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    // Update sentAt for all applications
    const updatedApplications = await Promise.all(
      applications.map(async (app) => {
        app.sentAt = new Date();
        await app.save();
        return {
          id: app._id,
          sentAt: app.sentAt
        };
      })
    );

    res.json({
      message: 'Applications sent successfully',
      sentCount: applications.length,
      updatedApplications
    });
  } catch (error) {
    console.error('Error in sendShortlistedApplications:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedApplication = await Application.findByIdAndDelete(id);
    
    if (!deletedApplication) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: error.message });
  }
};

