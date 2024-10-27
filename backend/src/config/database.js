const mongoose = require('mongoose');

module.exports = {
  connect: async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    }
  }
};