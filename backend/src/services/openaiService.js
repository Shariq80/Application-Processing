const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async scoreResume(resumeText, jobDescription) {
    try {
      // Clean up the input text
      const cleanedResumeText = resumeText.replace(/No resume text available/g, '').trim();
      
      const prompt = `
        Analyze this resume against the job description and respond with ONLY a JSON object containing:
        - score: number between 1-10
        - summary: brief 2-line summary
        
        Job Description:
        ${jobDescription}

        Resume Text:
        ${cleanedResumeText || 'No resume content provided'}
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an HR professional. Respond only with valid JSON containing 'score' and 'summary' fields."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      let responseText = completion.choices[0].message.content;
      
      // Clean up the response to ensure valid JSON
      responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();
      
      const response = JSON.parse(responseText);
      
      return {
        score: response.score || 5, // Default score if missing
        summary: response.summary || 'Unable to generate summary'
      };
    } catch (error) {
      console.error('OpenAI scoring error:', error);
      // Return default values instead of throwing
      return {
        score: 0,
        summary: 'Failed to analyze resume'
      };
    }
  }
}

module.exports = new OpenAIService();
