exports.parseEmailAddress = (emailString) => {
    const matches = emailString.match(/<(.+)>/);
    return matches ? matches[1] : emailString;
  };
  
  exports.parseSubject = (subject) => {
    const matches = subject.match(/Job Application: (.*)/i);
    return matches ? matches[1].trim() : null;
  };