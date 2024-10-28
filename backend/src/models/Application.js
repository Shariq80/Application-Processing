const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  data: Buffer,
  attachmentId: String
});

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  applicantName: String,
  applicantEmail: String,
  resumeText: String,
  emailBody: String,
  aiScore: Number,
  aiSummary: String,
  emailId: String,
  attachments: [attachmentSchema],
  isShortlisted: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  emailMetadata: {
    messageId: String,
    threadId: String
  }
});

module.exports = mongoose.model('Application', applicationSchema);
