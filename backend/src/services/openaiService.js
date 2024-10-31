const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async scoreResume(resumeText, jobDescription) {
    try {
      const cleanedResumeText = resumeText.replace(/No resume text available/g, '').trim();
      
      if (!cleanedResumeText || !jobDescription) {
        return {
          score: 0,
          summary: 'Unable to analyze - missing resume or job description'
        };
      }

      const prompt = `
        Analyze this resume against the job description and provide a JSON response in this exact format:
        {"score": <number between 1-10>, "summary": "<brief 2-line summary>"}
        
        Job Description:
        ${jobDescription}

        Resume Text:
        ${cleanedResumeText}
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an HR professional. Respond with valid JSON only, using double quotes for property names and string values."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      });
      
      let responseText = completion.choices[0].message.content;
      // Clean up any markdown formatting or extra whitespace
      responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        const response = JSON.parse(responseText);
        return {
          score: response.score || 5,
          summary: response.summary || 'Unable to generate summary'
        };
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', responseText);
        return {
          score: 5,
          summary: 'Error parsing AI response'
        };
      }
    } catch (error) {
      console.error('OpenAI scoring error:', error);
      return {
        score: 0,
        summary: 'Error analyzing resume: ' + error.message
      };
    }
  }
}

module.exports = new OpenAIService();
