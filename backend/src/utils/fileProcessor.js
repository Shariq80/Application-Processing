const pdf = require('pdf-parse');

exports.extractTextFromFile = async (buffer, mimeType) => {
  if (mimeType === 'application/pdf') {
    const data = await pdf(buffer);
    return data.text;
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
};