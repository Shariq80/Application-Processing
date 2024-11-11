require('dotenv').config();
const mongoose = require('mongoose');

async function updateIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.collections();
    const oauthCollection = collections.find(c => c.collectionName === 'oauthcredentials');
    
    if (oauthCollection) {
      // Drop existing indexes
      await oauthCollection.dropIndexes();
      
      // Create new compound index
      await oauthCollection.createIndex(
        { userId: 1, email: 1 }, 
        { unique: true }
      );
      
      // Create email index
      await oauthCollection.createIndex({ email: 1 });
      
      console.log('Successfully updated indexes');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

updateIndexes(); 