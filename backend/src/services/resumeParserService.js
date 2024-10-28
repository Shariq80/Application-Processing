const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class ResumeParserService {
  async parseResume(buffer, filename) {
    try {
      let text = '';
      
      // Check file extension instead of mime type
      if (filename.toLowerCase().endsWith('.pdf')) {
        const data = await pdf(buffer);
        text = data.text;
      } else if (filename.toLowerCase().endsWith('.doc') || filename.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        throw new Error(`Unsupported file type: ${filename}`);
      }

      const cleanedText = this.cleanText(text);
      return cleanedText;
    } catch (error) {
      console.error('Resume parsing error:', error);
      return ''; // Return empty string instead of throwing error
    }
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .trim();
  }
}

module.exports = new ResumeParserService();
