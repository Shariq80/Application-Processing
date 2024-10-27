const gmailService = require('../services/gmailService');
const openaiService = require('../services/openaiService');
const Application = require('../models/Application');
const Job = require('../models/Job');
const resumeParserService = require('../services/resumeParserService');

exports.fetchEmails = async (req, res) => {
  try {
    const { jobTitle } = req.query;
    console.log('\n=== Starting fetchEmails ===');
    console.log('1. Searching for job title:', jobTitle);
    
    if (!jobTitle) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    const existingJob = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
    });
    console.log('2. Job search result:', existingJob ? {
      id: existingJob._id,
      title: existingJob.title,
      description: existingJob.description?.substring(0, 50) + '...'
    } : 'No job found');
    
    if (!existingJob) {
      return res.status(404).json({ 
        error: `No job found matching "${jobTitle}". Please create the job first.` 
      });
    }

    console.log('3. Getting authorized Gmail client...');
    const gmail = await gmailService.getAuthorizedClient();
    
    console.log('4. Fetching unread emails...');
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread ${jobTitle}`
    });

    console.log('5. Gmail response:', {
      resultSizeEstimate: response.data.resultSizeEstimate,
      messagesCount: response.data.messages?.length || 0
    });

    const emails = response.data.messages || [];
    
    const processedEmails = [];
    console.log('6. Processing', emails.length, 'emails...');

    for (const email of emails) {
      console.log('\n--- Processing email:', email.id, '---');
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: email.id,
        format: 'full'
      });

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
    
    console.log('1. Email details:', {
      subject,
      from,
      jobTitle
    });

    if (!subject.toLowerCase().includes(jobTitle.toLowerCase())) {
      throw new Error('Job title not found in subject');
    }

    console.log('2. Finding job in database...');
    const job = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
    });
    
    if (!job) {
      throw new Error(`No matching job found for title: ${jobTitle}`);
    }
    console.log('3. Found matching job:', job.title);

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

exports.toggleShortlist = async (req, res) => {
  try {
    console.log('toggleShortlist called with params:', req.params);
    
    const application = await Application.findById(req.params.id);
    console.log('Found application:', application ? 'yes' : 'no');
    
    if (!application) {
      console.log('Application not found for ID:', req.params.id);
      return res.status(404).json({ error: 'Application not found' });
    }

    application.isShortlisted = !application.isShortlisted;
    console.log('Toggling shortlist status to:', application.isShortlisted);
    
    await application.save();
    console.log('Application saved successfully');

    res.json(application);
  } catch (error) {
    console.error('Error in toggleShortlist:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.sendShortlistedApplications = async (req, res) => {
  try {
    console.log('\n=== Starting sendShortlistedApplications ===');
    console.log('1. Request body:', req.body);
    
    const { jobId } = req.body;
    console.log('2. Extracted jobId:', jobId);
    
    if (!jobId) {
      console.log('3. Error: No jobId provided');
      return res.status(400).json({ error: 'jobId is required' });
    }

    console.log('4. Finding shortlisted applications...');
    const applications = await Application.find({
      job: jobId,
      isShortlisted: true
    }).populate('job');
    
    console.log('5. Found applications:', {
      count: applications.length,
      applicationIds: applications.map(app => app._id)
    });

    if (applications.length === 0) {
      console.log('6. Error: No shortlisted applications found');
      return res.status(400).json({ error: 'No shortlisted applications found' });
    }

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
          ${app.attachments.length > 0 ? `
            <p><strong>Attachments:</strong></p>
            <ul>
              ${app.attachments.map(att => `
                <li>${att.filename || 'Unnamed attachment'} (${att.contentType})</li>
              `).join('')}
            </ul>
          ` : '<p><em>No attachments</em></p>'}
          <p><strong>Original Email:</strong></p>
          <div style="margin-left: 20px;">${app.emailBody}</div>
        </div>
      `).join('')}
    `;

    // Get all attachments
    const attachments = applications.flatMap(app => 
      app.attachments.map(att => ({
        filename: `${app.applicantName}_${att.filename}`,
        contentType: att.contentType,
        data: att.data
      }))
    );

    // Send email
    await gmailService.sendEmail(
      req.user.email,
      `Shortlisted Candidates - ${applications[0].job.title}`,
      htmlContent,
      attachments
    );

    res.json({ message: 'Shortlisted applications sent successfully' });
  } catch (error) {
    console.error('Error in sendShortlistedApplications:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
};
