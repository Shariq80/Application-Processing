require('dotenv').config();
const mongoose = require('mongoose');
const OAuthCredential = require('../models/OAuthCredential');

async function updateDefaultGmail() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update the existing credential
    const result = await OAuthCredential.findByIdAndUpdate(
      '6730b0828657132011a71de8',  // Your existing credential ID
      {
        $set: {
          isDefault: true,
          // Add the email of your default Gmail account
          email: 'your-default@gmail.com'  // Replace with actual email
        }
      },
      { new: true }
    );

    if (result) {
      console.log('Default Gmail updated successfully:', result);
    } else {
      console.log('Credential not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Done');
  }
}

updateDefaultGmail(); 