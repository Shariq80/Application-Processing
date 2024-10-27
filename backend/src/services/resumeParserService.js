const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class ResumeParserService {
  async parseResume(buffer, fileType) {
    try {
      console.log(`Parsing resume with type: ${fileType}`);
      let text = '';
      
      if (fileType === 'application/pdf') {
        const data = await pdf(buffer);
        text = data.text;
      } else if (fileType.includes('msword') || fileType.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      const cleanedText = this.cleanText(text);
      console.log(`Parsed text length: ${cleanedText.length} characters`);
      return cleanedText;
    } catch (error) {
      console.error('Resume parsing error:', error);
      throw error;
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
